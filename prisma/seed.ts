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
  { resource: "field", action: "manage", description: "Assign observers to polling stations" },
  { resource: "field", action: "checkin", description: "Accept an assignment and check in at a polling station" },
  { resource: "field", action: "report", description: "Submit field reports and turnout snapshots" },
  { resource: "incidents", action: "review", description: "Acknowledge, resolve, or dismiss reported incidents" },
  { resource: "copilot", action: "use", description: "Query the ElectIQ Copilot" },
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
      ["field", "manage"], ["incidents", "read"], ["incidents", "review"], ["copilot", "use"],
    ],
  },
  NATIONAL_RETURNING_OFFICER: {
    description: "National-level verification and approval of results.",
    permissions: [
      ["elections", "read"], ["results", "read"], ["results", "verify"], ["results", "approve"],
      ["audit", "read"], ["integrity", "read"], ["integrity", "review"],
      ["incidents", "read"], ["incidents", "review"], ["copilot", "use"],
    ],
  },
  REGIONAL_OFFICER: {
    description: "Regional oversight of results and reporting progress.",
    permissions: [
      ["elections", "read"], ["results", "read"], ["results", "verify"],
      ["integrity", "read"], ["integrity", "review"], ["incidents", "read"], ["incidents", "review"],
      ["copilot", "use"],
    ],
  },
  CONSTITUENCY_OFFICER: {
    description: "Constituency-level verification of polling-station results.",
    permissions: [
      ["elections", "read"], ["results", "read"], ["results", "verify"],
      ["integrity", "read"], ["integrity", "review"], ["incidents", "read"], ["incidents", "review"],
      ["copilot", "use"],
    ],
  },
  POLLING_OFFICER: {
    description: "Submits results for an assigned polling station.",
    permissions: [["elections", "read"], ["results", "submit"]],
  },
  OBSERVER: {
    description: "Field observation and incident reporting within an assigned area.",
    permissions: [
      ["elections", "read"], ["incidents", "create"], ["incidents", "read"],
      ["field", "checkin"], ["field", "report"],
    ],
  },
  ANALYST: {
    description: "Read-only access to analytics and results data.",
    permissions: [["elections", "read"], ["results", "read"], ["integrity", "read"], ["copilot", "use"]],
  },
  MEDIA_USER: {
    description: "Read-only access to published election information.",
    permissions: [["elections", "read"]],
  },
  AUDITOR: {
    description: "Traces system actions across the platform.",
    permissions: [["elections", "read"], ["audit", "read"], ["integrity", "read"], ["copilot", "use"]],
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
      name: "Election Management System General Election 2026",
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

// ─────────────────────────────────────────────────────────────────────────
// SPRINT 8 — synthetic result generation for analytics
//
// Advanced Analytics (comparison, swing, competitiveness, distributions)
// is only meaningfully testable against real data spanning more than a
// handful of hand-entered submissions. This section seeds a full,
// deterministic (not random-every-run) set of PUBLISHED results: a
// completed historical election for comparison, and enough of the
// current election's remaining stations to make its own distributions
// non-trivial — while deliberately leaving some current-election
// stations unreported, so Sprint 4's live "reporting in progress"
// narrative and Sprint 8's analytics narrative both stay true at once.
// ─────────────────────────────────────────────────────────────────────────

/** Deterministic PRNG (mulberry32) seeded from a string, so re-running the seed produces identical synthetic results rather than different ones each time. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

type StationResultInput = {
  registeredVoters: number;
  ballotsIssued: number;
  votesCast: number;
  validVotes: number;
  rejectedBallots: number;
  candidateVotes: Array<{ candidateId: string; votes: number }>;
};

/**
 * Generates one polling station's result, biased by a per-region "lean"
 * vector (base vote share per candidate index) plus per-station jitter —
 * real enough to produce genuine regional swing and competitiveness
 * patterns, clearly synthetic in its numbers.
 */
function generateStationResult(
  stationCode: string,
  registeredVoters: number,
  candidateIds: string[],
  regionLean: number[]
): StationResultInput {
  const rng = seededRandom(stationCode);
  const turnoutFraction = 0.55 + rng() * 0.35; // 55%-90% turnout
  const ballotsIssued = Math.round(registeredVoters * turnoutFraction);
  const rejectedRate = 0.01 + rng() * 0.05; // 1%-6% rejected
  const votesCast = ballotsIssued;
  const rejectedBallots = Math.round(votesCast * rejectedRate);
  const validVotes = votesCast - rejectedBallots;

  const jittered = regionLean.map((w) => Math.max(0.02, w + (rng() - 0.5) * 0.15));
  const total = jittered.reduce((a, b) => a + b, 0);
  const shares = jittered.map((w) => w / total);

  const candidateVotes = candidateIds.map((candidateId, i) => ({
    candidateId,
    votes: Math.round(validVotes * shares[i]),
  }));
  // Rounding can drift the sum by a vote or two — true it up on the largest share so validVotes stays exact.
  const drift = validVotes - candidateVotes.reduce((sum, cv) => sum + cv.votes, 0);
  candidateVotes[shares.indexOf(Math.max(...shares))].votes += drift;

  return { registeredVoters, ballotsIssued, votesCast, validVotes, rejectedBallots, candidateVotes };
}

/** Region-level vote-share leanings per candidate index, distinct per region so swing/competitiveness analysis has real patterns to find. */
const REGION_LEANS: Record<string, number[]> = {
  "Northern Region": [0.5, 0.25, 0.15, 0.1],
  "Central Region": [0.3, 0.4, 0.2, 0.1],
  "Coastal Region": [0.2, 0.15, 0.2, 0.45],
};

async function publishResultsForElection(
  electionId: string,
  positionId: string,
  candidateIds: string[],
  options: { skipExisting: boolean; inclusionRate: number }
) {
  const stations = await db.pollingStation.findMany({
    include: { pollingCenter: { include: { unit: { include: { parent: { include: { parent: true } } } } } } },
  });

  let published = 0;
  for (const station of stations) {
    if (options.skipExisting) {
      const existing = await db.resultSubmission.findFirst({
        where: { electionId, positionId, pollingStationId: station.id },
      });
      if (existing) continue;
    }

    const rng = seededRandom(`${electionId}-${station.code}-include`);
    if (rng() > options.inclusionRate) continue;

    const regionName = station.pollingCenter.unit.parent?.parent?.name ?? "Northern Region";
    const lean = REGION_LEANS[regionName] ?? [0.25, 0.25, 0.25, 0.25];
    const result = generateStationResult(station.code, station.registeredVoters, candidateIds, lean);

    await db.resultSubmission.create({
      data: {
        electionId,
        positionId,
        pollingStationId: station.id,
        version: 1,
        status: "PUBLISHED",
        registeredVoters: result.registeredVoters,
        ballotsIssued: result.ballotsIssued,
        votesCast: result.votesCast,
        validVotes: result.validVotes,
        rejectedBallots: result.rejectedBallots,
        submittedAt: new Date(),
        verifiedAt: new Date(),
        approvedAt: new Date(),
        publishedAt: new Date(),
        candidateResults: { create: result.candidateVotes },
      },
    });
    published++;
  }
  return published;
}

async function seedHistoricalElection(countryId: string) {
  const election = await db.election.upsert({
    where: { id: "seed-karibu-general-2021" },
    update: {},
    create: {
      id: "seed-karibu-general-2021",
      countryId,
      name: "Election Management System General Election 2021",
      electionDate: new Date("2021-08-09"),
      status: "ARCHIVED",
    },
  });

  const position = await db.electionPosition.upsert({
    where: { electionId_name: { electionId: election.id, name: "President" } },
    update: {},
    create: { electionId: election.id, name: "President" },
  });

  // Same party lineup as 2026 (the natural case in most real democracies —
  // parties persist across elections even as candidates change), with a
  // 2021 candidate slate distinct from the 2026 one so comparisons reflect
  // genuine electoral change rather than the same names re-winning by
  // construction.
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
    { fullName: "Josephine Waweru", partyAbbr: "UFP" },
    { fullName: "Peter Njau", partyAbbr: "NPA" },
    { fullName: "Grace Otieno", partyAbbr: "KRM" },
    { fullName: "Samuel Mwangi", partyAbbr: "CPC" },
  ];
  const candidateIds: string[] = [];
  for (const c of candidates) {
    const party = partyRecords.find((p) => p.abbreviation === c.partyAbbr)!;
    const existing = await db.candidate.findFirst({
      where: { electionId: election.id, positionId: position.id, fullName: c.fullName },
    });
    const candidate =
      existing ??
      (await db.candidate.create({
        data: { electionId: election.id, positionId: position.id, partyId: party.id, fullName: c.fullName },
      }));
    candidateIds.push(candidate.id);
  }

  const published = await publishResultsForElection(election.id, position.id, candidateIds, {
    skipExisting: true,
    inclusionRate: 1, // historical election: fully reported and certified
  });

  return { election, position, candidateIds, published };
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
  console.log("Seeding ElectIQ — Election Management System synthetic environment...");

  const country = await db.country.upsert({
    where: { isoCode: "KRB" },
    update: {},
    create: { name: "Election Management System", isoCode: "KRB" },
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

  // Give the demo observer a real accreditation profile and an assignment
  // to an actual polling station, so Sprint 6's field operations flow has
  // something real to check in against out of the box.
  const observerUser = await db.user.findUniqueOrThrow({ where: { email: "observer@electiq.example" } });
  const observer = await db.observer.upsert({
    where: { userId: observerUser.id },
    update: {},
    create: {
      userId: observerUser.id,
      organization: "Karibu Civic Transparency Coalition",
      accreditationNumber: "KCTC-2026-0001",
      phone: "+254-700-000-000",
    },
  });
  const firstStation = await db.pollingStation.findFirstOrThrow({
    orderBy: { code: "asc" },
  });
  await db.observerAssignment.upsert({
    where: { observerId_pollingStationId: { observerId: observer.id, pollingStationId: firstStation.id } },
    update: {},
    create: { observerId: observer.id, pollingStationId: firstStation.id },
  });

  // Sprint 8 — a completed historical election (fully published) so
  // comparison/swing analytics have real data to compare against, plus
  // filling in most (not all — Sprint 4's live "reporting in progress"
  // narrative stays true) of the current election's remaining stations.
  const historical = await seedHistoricalElection(country.id);

  const presidency2026 = await db.electionPosition.findFirstOrThrow({
    where: { electionId: election.id, name: "President" },
  });
  const candidates2026 = await db.candidate.findMany({ where: { positionId: presidency2026.id } });
  const backfilled = await publishResultsForElection(
    election.id,
    presidency2026.id,
    candidates2026.map((c) => c.id),
    { skipExisting: true, inclusionRate: 0.85 }
  );

  console.log("Seed complete.");
  console.log(`  Country: ${country.name}`);
  console.log(`  Election: ${election.name} (${election.status})`);
  console.log(`  Polling stations: ${geography.stationCount}, registered voters: ${geography.voterTotal}`);
  console.log(`  Roles seeded: ${Object.keys(roles).length}`);
  console.log(`  Demo users: ${demoUsers.length} (password for all: ${DEMO_PASSWORD})`);
  console.log(`  Observer assignment: ${observerUser.email} -> ${firstStation.code}`);
  console.log(`  Historical election: ${historical.election.name} (${historical.published} stations published)`);
  console.log(`  Current election backfill: ${backfilled} additional stations published for analytics`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
