/**
 * Builds Kenya's administrative hierarchy — County → Constituency → Ward —
 * directly from the codes already present in a raw IEBC-style
 * polling-station reference CSV (County_code/County_Name,
 * Const_code/Const_Name, CAW_Code/CAW_Name columns).
 *
 * This is deliberately a ONE-TIME SETUP script, not part of the app's
 * regular polling-station import feature (which only ever adds stations
 * under geography that already exists — it was never designed to create
 * counties/constituencies/wards from scratch, and still isn't; this
 * script exists precisely because that gap is real).
 *
 * Idempotent: safe to re-run. Every unit is upserted by (level, code), so
 * running this twice with the same file does not create duplicates.
 *
 * Usage:
 *   DATABASE_URL="postgresql://...(your Supabase pooler string)..." \
 *     npx tsx scripts/import-kenya-geography.ts scripts/kenya-polling-stations-source.csv
 */
import { readFileSync } from "fs";
import Papa from "papaparse";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type SourceRow = {
  County_code: string;
  County_Name: string;
  Const_code: string;
  Const_Name: string;
  CAW_Code: string;
  CAW_Name: string;
  PS_Code: string;
  PS_Name: string;
};

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-kenya-geography.ts <path-to-source-csv>");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const csvText = readFileSync(filePath, "utf-8");
  const { data, errors } = Papa.parse<SourceRow>(csvText, { header: true, skipEmptyLines: true });
  if (errors.length > 0) {
    console.error("CSV parse errors:", errors);
    process.exit(1);
  }

  const rows = data.filter((r) => r.County_code);
  console.log(`Parsed ${rows.length} polling-station rows from the source file.`);

  const counties = new Map<string, string>();
  const constituencies = new Map<string, { name: string; countyCode: string }>();
  const wards = new Map<string, { name: string; constCode: string }>();

  for (const r of rows) {
    counties.set(r.County_code, r.County_Name.trim());
    constituencies.set(r.Const_code, { name: r.Const_Name.trim(), countyCode: r.County_code });
    wards.set(r.CAW_Code, { name: r.CAW_Name.trim(), constCode: r.Const_code });
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

  console.log("\nDone. Kenya's County -> Constituency -> Ward hierarchy is now in the database.");
  console.log("Next: source registered_voters/latitude/longitude for each polling station (Step 2),");
  console.log("then run scripts/transform-kenya-polling-stations.ts (Step 3) to produce an");
  console.log("import-ready CSV for the app's own /command-center/polling-stations/import page.");

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
