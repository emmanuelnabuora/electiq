import { PrismaClient, RoleName } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { setUnitBoundary, setPollingCenterLocation, rectangleRing } from "../src/lib/gis";

// Fictional Republic of Karibu is laid out on a simple grid roughly in the
// same longitude/latitude range as East Africa, purely so the seeded
// geometry renders sensibly on a real map — these are not real coordinates.
const KARIBU_ORIGIN: [number, number] = [36.0, -1.0]; // [longitude, latitude]

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// Demo password for every seeded account. Documented in README — rotate
// before any non-local use.
const DEMO_PASSWORD = "ElectIQ2026!";

// Permission catalog. Section 8 of the master spec models permissions as
// (resource, action, geographic scope); geographic scope is resolved at
// query time from UserScope, so only (resource, action) is stored here.
// Sprint 1 enforces `elections.read` and `audit.read` in the app itself;
// the remaining entries establish the schema ahead of the sprints that
// implement their workflows, so RBAC does not need to be redesigned later.
const PERMISSIONS: Array<{ resource: string; action: string; description: string }> = [
  { resource: "elections", action: "read", description: "View election configuration and geography" },
  { resource: "elections", action: "create", description: "Create a new election" },
  { resource: "elections", action: "update", description: "Modify election configuration" },
  { resource: "results", action: "read", description: "View submitted results" },
  { resource: "results", action: "submit", description: "Submit polling-station results" },
  { resource: "results", action: "verify", description: "Verify submitted results" },
  { resource: "results", action: "approve", description: "Approve verified results" },
  { resource: "results", action: "publish", description: "Publish approved results" },
  { resource: "incidents", action: "create", description: "Report a field incident" },
  { resource: "incidents", action: "read", description: "View reported incidents" },
  { resource: "audit", action: "read", description: "View audit logs" },
  { resource: "users", action: "manage", description: "Manage user accounts and role assignments" },
  { resource: "geography", action: "manage", description: "Manage administrative units, polling centers/stations, and bulk import" },
  { resource: "integrity", action: "read", description: "View integrity alerts" },
  { resource: "integrity", action: "review", description: "Assign, resolve, or dismiss integrity alerts" },
];

const ROLE_DEFINITIONS: Record<RoleName, { description: string; permissions: Array<[string, string]> }> = {
  SUPER_ADMIN: {
    description: "Full system access across every module and geography.",
    permissions: PERMISSIONS.map((p) => [p.resource, p.action]),
  },
  ELECTION_COMMISSIONER: {
    description: "National oversight of election configuration and result publication.",
    permissions: [
      ["elections", "read"], ["elections", "create"], ["elections", "update"],
      ["results", "read"], ["results", "approve"], ["results", "publish"],
      ["audit", "read"], ["geography", "manage"], ["integrity", "read"], ["integrity", "review"],
    ],
  },
  NATIONAL_RETURNING_OFFICER: {
    description: "National-level verification and approval of results.",
    permissions: [
      ["elections", "read"], ["results", "read"], ["results", "verify"], ["results", "approve"],
      ["audit", "read"], ["integrity", "read"], ["integrity", "review"],
    ],
  },
  REGIONAL_OFFICER: {
    description: "Regional oversight of results and reporting progress.",
    permissions: [["elections", "read"], ["results", "read"], ["results", "verify"], ["integrity", "read"], ["integrity", "review"]],
  },
  CONSTITUENCY_OFFICER: {
    description: "Constituency-level verification of polling-station results.",
    permissions: [["elections", "read"], ["results", "read"], ["results", "verify"], ["integrity", "read"], ["integrity", "review"]],
  },
  POLLING_OFFICER: {
    description: "Submits results for an assigned polling station.",
    permissions: [["elections", "read"], ["results", "submit"]],
  },
  OBSERVER: {
    description: "Field observation and incident reporting within an assigned area.",
    permissions: [["elections", "read"], ["incidents", "create"], ["incidents", "read"]],
  },
  ANALYST: {
    description: "Read-only access to analytics and results data.",
    permissions: [["elections", "read"], ["results", "read"], ["integrity", "read"]],
  },
  MEDIA_USER: {
    description: "Read-only access to published election information.",
    permissions: [["elections", "read"]],
  },
  AUDITOR: {
    description: "Traces system actions across the platform.",
    permissions: [["elections", "read"], ["audit", "read"], ["integrity", "read"]],
  },
  PARTY_AGENT: {
    description: "Authorized party representative observing results in their race.",
    permissions: [["elections", "read"], ["results", "read"]],
  },
};

async function seedRbac() {
  const permissionRecords = await Promise.all(
    PERMISSIONS.map((p) =>
      db.permission.upsert({
        where: { resource_action: { resource: p.resource, action: p.action } },
        update: { description: p.description },
        create: p,
      })
    )
  );
  const permissionId = (resource: string, action: string) =>
    permissionRecords.find((p) => p.resource === resource && p.action === action)!.id;

  const roles: Record<string, { id: string }> = {};
  for (const [name, def] of Object.entries(ROLE_DEFINITIONS) as [RoleName, typeof ROLE_DEFINITIONS[RoleName]][]) {
    const role = await db.role.upsert({
      where: { name },
      update: { description: def.description },
      create: { name, description: def.description },
    });
    roles[name] = role;

    for (const [resource, action] of def.permissions) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permissionId(resource, action) } },
        update: {},
        create: { roleId: role.id, permissionId: permissionId(resource, action) },
      });
    }
  }
  return roles;
}

async function seedGeography(countryId: string) {
  const levelNames = ["Region", "Constituency", "Ward"];
  const levels = await Promise.all(
    levelNames.map((name, depth) =>
      db.administrativeLevel.upsert({
        where: { countryId_depth: { countryId, depth } },
        update: { name },
        create: { countryId, name, depth },
      })
    )
  );
  const [regionLevel, constituencyLevel, wardLevel] = levels;

  // Reduced-scale structural seed: 3 regions x 2 constituencies x 2 wards
  // x 2 polling centers x 2 polling stations. The hierarchy and bulk-import
  // pipeline (Sprint 2) are what scale this to the full ~800-station
  // Republic of Karibu dataset described in the master spec.
  const regionNames = ["Northern Region", "Central Region", "Coastal Region"];
  let stationCount = 0;
  let voterTotal = 0;

  const [originLng, originLat] = KARIBU_ORIGIN;
  const REGION_SPACING = 1.3;
  const REGION_HALF = 0.5;

  for (let r = 0; r < regionNames.length; r++) {
    const regionCenterLng = originLng + r * REGION_SPACING;
    const regionCenterLat = originLat;

    const region = await db.administrativeUnit.upsert({
      where: { levelId_code: { levelId: regionLevel.id, code: `REG-${r + 1}` } },
      update: {},
      create: { levelId: regionLevel.id, code: `REG-${r + 1}`, name: regionNames[r] },
    });
    await setUnitBoundary(
      region.id,
      rectangleRing(regionCenterLng, regionCenterLat, REGION_HALF, REGION_HALF),
      db
    );

    for (let c = 0; c < 2; c++) {
      const conCenterLng = regionCenterLng + (c === 0 ? -REGION_HALF / 2 : REGION_HALF / 2);
      const conCenterLat = regionCenterLat;
      const conHalfW = REGION_HALF / 2 - 0.03;
      const conHalfH = REGION_HALF - 0.05;

      const constituency = await db.administrativeUnit.upsert({
        where: { levelId_code: { levelId: constituencyLevel.id, code: `REG${r + 1}-CON${c + 1}` } },
        update: {},
        create: {
          levelId: constituencyLevel.id,
          parentId: region.id,
          code: `REG${r + 1}-CON${c + 1}`,
          name: `${regionNames[r]} Constituency ${c + 1}`,
        },
      });
      await setUnitBoundary(
        constituency.id,
        rectangleRing(conCenterLng, conCenterLat, conHalfW, conHalfH),
        db
      );

      for (let w = 0; w < 2; w++) {
        const wardCenterLng = conCenterLng;
        const wardCenterLat = conCenterLat + (w === 0 ? -conHalfH / 2 : conHalfH / 2);
        const wardHalfW = conHalfW - 0.02;
        const wardHalfH = conHalfH / 2 - 0.02;

        const ward = await db.administrativeUnit.upsert({
          where: { levelId_code: { levelId: wardLevel.id, code: `REG${r + 1}-CON${c + 1}-WRD${w + 1}` } },
          update: {},
          create: {
            levelId: wardLevel.id,
            parentId: constituency.id,
            code: `REG${r + 1}-CON${c + 1}-WRD${w + 1}`,
            name: `Ward ${w + 1}`,
          },
        });
        await setUnitBoundary(
          ward.id,
          rectangleRing(wardCenterLng, wardCenterLat, wardHalfW, wardHalfH),
          db
        );

        for (let pc = 0; pc < 2; pc++) {
          const centerCode = `REG${r + 1}-CON${c + 1}-WRD${w + 1}-PC${pc + 1}`;
          const centerLng = wardCenterLng + (pc === 0 ? -wardHalfW / 2 : wardHalfW / 2);
          const centerLat = wardCenterLat;
          const center = await db.pollingCenter.upsert({
            where: { code: centerCode },
            update: { latitude: centerLat, longitude: centerLng },
            create: {
              unitId: ward.id,
              code: centerCode,
              name: `Polling Center ${pc + 1}`,
              latitude: centerLat,
              longitude: centerLng,
            },
          });
          await setPollingCenterLocation(center.id, centerLat, centerLng, db);

          for (let ps = 0; ps < 2; ps++) {
            const stationCode = `${centerCode}-PS${ps + 1}`;
            const registeredVoters = 800 + ((r + c + w + pc + ps) % 5) * 300;
            await db.pollingStation.upsert({
              where: { code: stationCode },
              update: { registeredVoters },
              create: {
                pollingCenterId: center.id,
                code: stationCode,
                name: `Polling Station ${ps + 1}`,
                registeredVoters,
              },
            });
            stationCount++;
            voterTotal += registeredVoters;
          }
        }
      }
    }
  }

  return { regionLevel, constituencyLevel, wardLevel, stationCount, voterTotal };
}

async function seedElection(countryId: string) {
  const election = await db.election.upsert({
    where: { id: "seed-karibu-general-2026" },
    update: {},
    create: {
      id: "seed-karibu-general-2026",
      countryId,
      name: "Karibu General Election 2026",
      electionDate: new Date("2026-10-12"),
      status: "CONFIGURED",
    },
  });

  const positionNames = ["President", "Member of Parliament", "Regional Governor"];
  const positions = await Promise.all(
    positionNames.map((name) =>
      db.electionPosition.upsert({
        where: { electionId_name: { electionId: election.id, name } },
        update: {},
        create: { electionId: election.id, name },
      })
    )
  );
  const presidency = positions[0];

  const parties = [
    { name: "Unity Forward Party", abbreviation: "UFP", colorHex: "#2F80ED" },
    { name: "National Progress Alliance", abbreviation: "NPA", colorHex: "#22C55E" },
    { name: "Karibu Reform Movement", abbreviation: "KRM", colorHex: "#F59E0B" },
    { name: "Coastal Peoples Congress", abbreviation: "CPC", colorHex: "#EF4444" },
  ];
  const partyRecords = await Promise.all(
    parties.map((p) =>
      db.party.upsert({
        where: { electionId_abbreviation: { electionId: election.id, abbreviation: p.abbreviation } },
        update: {},
        create: { electionId: election.id, ...p },
      })
    )
  );

  const candidates = [
    { fullName: "Amara Kito", partyAbbr: "UFP" },
    { fullName: "Daniel Bako", partyAbbr: "NPA" },
    { fullName: "Nuru Esani", partyAbbr: "KRM" },
    { fullName: "Lena Moro", partyAbbr: "CPC" },
  ];
  for (const c of candidates) {
    const party = partyRecords.find((p) => p.abbreviation === c.partyAbbr)!;
    const existing = await db.candidate.findFirst({
      where: { electionId: election.id, positionId: presidency.id, fullName: c.fullName },
    });
    if (!existing) {
      await db.candidate.create({
        data: {
          electionId: election.id,
          positionId: presidency.id,
          partyId: party.id,
          fullName: c.fullName,
        },
      });
    }
  }

  return election;
}

async function seedUsers(roles: Record<string, { id: string }>, regionUnitId: string, constituencyUnitId: string) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const demoUsers: Array<{
    email: string;
    name: string;
    role: RoleName;
    scope: "national" | "regional" | "constituency";
  }> = [
    { email: "admin@electiq.example", name: "System Administrator", role: "SUPER_ADMIN", scope: "national" },
    { email: "commissioner@electiq.example", name: "Wanjiru Kamau", role: "ELECTION_COMMISSIONER", scope: "national" },
    { email: "nro@electiq.example", name: "Peter Otieno", role: "NATIONAL_RETURNING_OFFICER", scope: "national" },
    { email: "regional.officer@electiq.example", name: "Grace Mwangi", role: "REGIONAL_OFFICER", scope: "regional" },
    { email: "constituency.officer@electiq.example", name: "James Kiptoo", role: "CONSTITUENCY_OFFICER", scope: "constituency" },
    { email: "polling.officer@electiq.example", name: "Sarah Njoroge", role: "POLLING_OFFICER", scope: "constituency" },
    { email: "observer@electiq.example", name: "Tom Achieng", role: "OBSERVER", scope: "constituency" },
    { email: "analyst@electiq.example", name: "Faith Wambui", role: "ANALYST", scope: "national" },
    { email: "media@electiq.example", name: "David Mutua", role: "MEDIA_USER", scope: "national" },
    { email: "auditor@electiq.example", name: "Ruth Chebet", role: "AUDITOR", scope: "national" },
    { email: "party.agent@electiq.example", name: "Michael Odhiambo", role: "PARTY_AGENT", scope: "constituency" },
  ];

  for (const u of demoUsers) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: { name: u.name, passwordHash },
      create: { email: u.email, name: u.name, passwordHash },
    });

    await db.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles[u.role].id } },
      update: {},
      create: { userId: user.id, roleId: roles[u.role].id },
    });

    const existingScope = await db.userScope.findFirst({ where: { userId: user.id } });
    if (!existingScope) {
      if (u.scope === "national") {
        await db.userScope.create({ data: { userId: user.id, isNational: true } });
      } else if (u.scope === "regional") {
        await db.userScope.create({ data: { userId: user.id, scopeUnitId: regionUnitId } });
      } else {
        await db.userScope.create({ data: { userId: user.id, scopeUnitId: constituencyUnitId } });
      }
    }
  }

  return demoUsers;
}

async function main() {
  console.log("Seeding ElectIQ — Republic of Karibu synthetic environment...");

  const country = await db.country.upsert({
    where: { isoCode: "KRB" },
    update: {},
    create: { name: "Republic of Karibu", isoCode: "KRB" },
  });

  const roles = await seedRbac();
  const geography = await seedGeography(country.id);
  const election = await seedElection(country.id);

  const firstRegion = await db.administrativeUnit.findFirstOrThrow({
    where: { levelId: geography.regionLevel.id },
  });
  const firstConstituency = await db.administrativeUnit.findFirstOrThrow({
    where: { levelId: geography.constituencyLevel.id, parentId: firstRegion.id },
  });

  const demoUsers = await seedUsers(roles, firstRegion.id, firstConstituency.id);

  console.log("Seed complete.");
  console.log(`  Country: ${country.name}`);
  console.log(`  Election: ${election.name} (${election.status})`);
  console.log(`  Polling stations: ${geography.stationCount}, registered voters: ${geography.voterTotal}`);
  console.log(`  Roles seeded: ${Object.keys(roles).length}`);
  console.log(`  Demo users: ${demoUsers.length} (password for all: ${DEMO_PASSWORD})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
