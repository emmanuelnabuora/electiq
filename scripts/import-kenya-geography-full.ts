/**
 * Builds (or extends) Kenya's administrative hierarchy — County ->
 * Constituency -> Ward — from SIMULATION_POLLING_STATIONS_Final_-_v2_0.xlsx,
 * which covers all 47 counties / 290 constituencies / 292 wards (far more
 * complete than the earlier 57-row CSV this project started with).
 *
 * Code normalization: this workbook's codes are plain integers ("1", "2",
 * "11"), while the earlier CSV's codes were zero-padded strings ("002",
 * "007", "0034") for the SAME real places. Without normalizing both to
 * the same format, re-running this against the already-seeded database
 * would create duplicate counties/constituencies/wards instead of
 * recognizing Kwale-the-second-time as the same Kwale. Both sources are
 * zero-padded here to the same widths (county: 3, constituency: 3,
 * ward: 4) before being used as lookup/upsert keys.
 *
 * Idempotent: safe to re-run, including after import-kenya-geography.ts.
 *
 * Usage:
 *   DATABASE_URL="postgresql://...(your Supabase pooler string)..." \
 *     npx tsx scripts/import-kenya-geography-full.ts \
 *     scripts/SIMULATION_POLLING_STATIONS_Final_-_v2_0.xlsx
 */
import * as XLSX from "xlsx";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type SourceRow = {
  "COUNTY CODE": number | string;
  "COUNTY NAME": string;
  "CONSTITUENCY CODE": number | string;
  "CONSTITUENCY NAME": string;
  "CAW CODE": number | string;
  CAW_NAME: string;
};

function pad(value: number | string, width: number): string {
  return String(value).trim().padStart(width, "0");
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-kenya-geography-full.ts <path-to-xlsx>");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<SourceRow>(sheet);
  console.log(`Parsed ${rows.length} polling-station rows from the workbook.`);

  const counties = new Map<string, string>();
  const constituencies = new Map<string, { name: string; countyCode: string }>();
  const wards = new Map<string, { name: string; constCode: string }>();

  for (const r of rows) {
    const countyCode = pad(r["COUNTY CODE"], 3);
    const constCode = pad(r["CONSTITUENCY CODE"], 3);
    const wardCode = pad(r["CAW CODE"], 4);
    counties.set(countyCode, String(r["COUNTY NAME"]).trim());
    constituencies.set(constCode, { name: String(r["CONSTITUENCY NAME"]).trim(), countyCode });
    wards.set(wardCode, { name: String(r["CAW_NAME"]).trim(), constCode });
  }

  console.log(
    `Derived ${counties.size} counties, ${constituencies.size} constituencies, ${wards.size} wards.`
  );

  const country = await db.country.upsert({
    where: { isoCode: "KE" },
    update: {},
    create: { name: "Kenya", isoCode: "KE" },
  });
  console.log(`Country: ${country.name} (${country.id})`);

  const countyLevel = await db.administrativeLevel.upsert({
    where: { countryId_depth: { countryId: country.id, depth: 0 } },
    update: { name: "County" },
    create: { countryId: country.id, name: "County", depth: 0 },
  });
  const constLevel = await db.administrativeLevel.upsert({
    where: { countryId_depth: { countryId: country.id, depth: 1 } },
    update: { name: "Constituency" },
    create: { countryId: country.id, name: "Constituency", depth: 1 },
  });
  const wardLevel = await db.administrativeLevel.upsert({
    where: { countryId_depth: { countryId: country.id, depth: 2 } },
    update: { name: "Ward" },
    create: { countryId: country.id, name: "Ward", depth: 2 },
  });

  const countyUnitByCode = new Map<string, string>();
  for (const [code, name] of counties) {
    const existing = await db.administrativeUnit.findFirst({ where: { levelId: countyLevel.id, code } });
    const unit = existing
      ? await db.administrativeUnit.update({ where: { id: existing.id }, data: { name } })
      : await db.administrativeUnit.create({ data: { levelId: countyLevel.id, code, name } });
    countyUnitByCode.set(code, unit.id);
  }
  console.log(`Upserted ${countyUnitByCode.size} county units.`);

  const constUnitByCode = new Map<string, string>();
  for (const [code, { name, countyCode }] of constituencies) {
    const parentId = countyUnitByCode.get(countyCode)!;
    const existing = await db.administrativeUnit.findFirst({ where: { levelId: constLevel.id, code } });
    const unit = existing
      ? await db.administrativeUnit.update({ where: { id: existing.id }, data: { name, parentId } })
      : await db.administrativeUnit.create({ data: { levelId: constLevel.id, code, name, parentId } });
    constUnitByCode.set(code, unit.id);
  }
  console.log(`Upserted ${constUnitByCode.size} constituency units.`);

  let wardCount = 0;
  for (const [code, { name, constCode }] of wards) {
    const parentId = constUnitByCode.get(constCode)!;
    const existing = await db.administrativeUnit.findFirst({ where: { levelId: wardLevel.id, code } });
    if (existing) await db.administrativeUnit.update({ where: { id: existing.id }, data: { name, parentId } });
    else await db.administrativeUnit.create({ data: { levelId: wardLevel.id, code, name, parentId } });
    wardCount++;
  }
  console.log(`Upserted ${wardCount} ward units.`);

  console.log("\nDone. Kenya's full County -> Constituency -> Ward hierarchy is now in the database.");
  console.log("Next: run scripts/transform-kenya-simulation-polling-stations.ts to produce an");
  console.log("import-ready CSV -- its voter counts are SIMULATED, not real, until replaced.");

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
