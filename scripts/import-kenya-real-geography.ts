/**
 * Builds Kenya's COMPLETE real administrative hierarchy — all 47 real
 * counties, all 290 real constituencies, all real wards, plus the two
 * special non-geographic categories IEBC itself treats as
 * county-equivalents: Diaspora (048, with each country as its
 * ward-equivalent) and Prisons (049) — using real names from
 * kenya-geography-names.csv and real codes/relationships from
 * kenya-real-polling-stations.csv.
 *
 * Ward codes are unique nationally in this data (verified: zero ward
 * code appears under more than one constituency), so units are looked
 * up by (level, code) alone, matching the same pattern already proven
 * in the earlier geography scripts.
 *
 * This supersedes import-kenya-geography.ts and
 * import-kenya-geography-full.ts, which only covered a partial or
 * simulated subset. Idempotent: safe to re-run.
 *
 * Usage:
 *   DATABASE_URL="postgresql://...(your Supabase pooler string)..." \
 *     npx tsx scripts/import-kenya-real-geography.ts \
 *     scripts/kenya-real-polling-stations.csv \
 *     scripts/kenya-geography-names.csv
 */
import { readFileSync } from "fs";
import Papa from "papaparse";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type Row = {
  region_code: string;
  constituency_code: string;
  ward_code: string;
};

type NameRow = {
  level: "county" | "constituency" | "ward";
  code: string;
  name: string;
};

async function main() {
  const filePath = process.argv[2];
  const namesPath = process.argv[3];
  if (!filePath || !namesPath) {
    console.error(
      "Usage: npx tsx scripts/import-kenya-real-geography.ts <polling-stations.csv> <geography-names.csv>"
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const csvText = readFileSync(filePath, "utf-8");
  const { data, errors } = Papa.parse<Row>(csvText, { header: true, skipEmptyLines: true });
  if (errors.length > 0) {
    console.error("CSV parse errors:", errors.slice(0, 5));
    process.exit(1);
  }

  const namesText = readFileSync(namesPath, "utf-8");
  const { data: nameRows } = Papa.parse<NameRow>(namesText, { header: true, skipEmptyLines: true });
  const nameByCode = new Map<string, string>();
  for (const n of nameRows) nameByCode.set(`${n.level}:${n.code}`, n.name);

  console.log(`Parsed ${data.length} polling-station rows and ${nameRows.length} name entries.`);

  const counties = new Set<string>();
  const constituencies = new Map<string, string>();
  const wards = new Map<string, string>();

  for (const r of data) {
    if (!r.region_code) continue;
    counties.add(r.region_code);
    if (!constituencies.has(r.constituency_code)) constituencies.set(r.constituency_code, r.region_code);
    if (!wards.has(r.ward_code)) wards.set(r.ward_code, r.constituency_code);
  }

  console.log(`Derived ${counties.size} counties, ${constituencies.size} constituencies, ${wards.size} wards.`);

  const country = await db.country.upsert({
    where: { isoCode: "KE" },
    update: {},
    create: { name: "Kenya", isoCode: "KE" },
  });

  const countyLevel = await db.administrativeLevel.upsert({
    where: { countryId_depth: { countryId: country.id, depth: 0 } },
    update: {},
    create: { countryId: country.id, name: "County", depth: 0 },
  });
  const constLevel = await db.administrativeLevel.upsert({
    where: { countryId_depth: { countryId: country.id, depth: 1 } },
    update: {},
    create: { countryId: country.id, name: "Constituency", depth: 1 },
  });
  const wardLevel = await db.administrativeLevel.upsert({
    where: { countryId_depth: { countryId: country.id, depth: 2 } },
    update: {},
    create: { countryId: country.id, name: "Ward", depth: 2 },
  });

  const countyUnitByCode = new Map<string, string>();
  for (const code of counties) {
    const name = nameByCode.get(`county:${code}`) ?? code;
    const existing = await db.administrativeUnit.findFirst({ where: { levelId: countyLevel.id, code } });
    if (existing) {
      await db.administrativeUnit.update({ where: { id: existing.id }, data: { name } });
      countyUnitByCode.set(code, existing.id);
    } else {
      const unit = await db.administrativeUnit.create({ data: { levelId: countyLevel.id, code, name } });
      countyUnitByCode.set(code, unit.id);
    }
  }
  console.log(`Counties resolved: ${countyUnitByCode.size}`);

  const constUnitByCode = new Map<string, string>();
  for (const [code, countyCode] of constituencies) {
    const name = nameByCode.get(`constituency:${code}`) ?? code;
    const parentId = countyUnitByCode.get(countyCode)!;
    const existing = await db.administrativeUnit.findFirst({ where: { levelId: constLevel.id, code } });
    if (existing) {
      await db.administrativeUnit.update({ where: { id: existing.id }, data: { name, parentId } });
      constUnitByCode.set(code, existing.id);
    } else {
      const unit = await db.administrativeUnit.create({ data: { levelId: constLevel.id, code, name, parentId } });
      constUnitByCode.set(code, unit.id);
    }
  }
  console.log(`Constituencies resolved: ${constUnitByCode.size}`);

  let wardCreated = 0;
  let wardExisting = 0;
  for (const [code, constCode] of wards) {
    const name = nameByCode.get(`ward:${code}`) ?? code;
    const parentId = constUnitByCode.get(constCode)!;
    const existing = await db.administrativeUnit.findFirst({ where: { levelId: wardLevel.id, code } });
    if (existing) {
      await db.administrativeUnit.update({ where: { id: existing.id }, data: { name, parentId } });
      wardExisting++;
    } else {
      await db.administrativeUnit.create({ data: { levelId: wardLevel.id, code, name, parentId } });
      wardCreated++;
    }
  }
  console.log(`Wards created: ${wardCreated}, already existing: ${wardExisting}`);

  console.log("\nDone.");
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
