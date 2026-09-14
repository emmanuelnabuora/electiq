/**
 * Imports the full real Kenya polling-station dataset directly against
 * the database, using the EXACT SAME validation and commit functions
 * ElectIQ's own /command-center/polling-stations/import page uses
 * (src/lib/import/polling-stations.ts) — this is not a separate, custom
 * import path that could behave differently, just the real one invoked
 * from a script instead of a web request.
 *
 * WHY THIS SCRIPT EXISTS RATHER THAN JUST USING THE WEB UI: tested
 * against a real database, committing all ~27,400 rows took over a
 * MINUTE (66.5s). Vercel's serverless functions default to a 10-second
 * timeout (up to 60s on some plans) — importing a file this size through
 * the actual web page's server action will very likely time out and
 * fail partway through. Running it as a plain script from your own
 * machine has no such limit.
 *
 * Prerequisite: run import-kenya-real-geography.ts FIRST against the
 * same database, so the county/constituency/ward hierarchy this data
 * references already exists.
 *
 * Usage:
 *   DATABASE_URL="postgresql://...(your Supabase pooler string)..." \
 *     npx tsx scripts/import-kenya-real-polling-stations.ts \
 *     scripts/kenya-real-polling-stations.csv
 */
import { readFileSync } from "fs";
import {
  parsePollingStationsCsv,
  validatePollingStationsRows,
  commitValidRows,
} from "../src/lib/import/polling-stations";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-kenya-real-polling-stations.ts <path-to-csv>");
    process.exit(1);
  }

  const csvText = readFileSync(filePath, "utf-8");
  const { records, parseErrors } = parsePollingStationsCsv(csvText);
  if (parseErrors.length > 0) {
    console.error("CSV parse errors:", parseErrors.slice(0, 10));
    process.exit(1);
  }

  console.log(`Parsed ${records.length} rows. Validating against the existing geography...`);
  const preview = await validatePollingStationsRows(records);
  console.log(`Valid: ${preview.validRows} / ${preview.totalRows}`);

  if (preview.errorRows > 0) {
    console.error(`\n${preview.errorRows} rows failed validation. Not importing anything until these are fixed.`);
    console.error("Did you run import-kenya-real-geography.ts against this same database first?");
    for (const r of preview.rows.filter((x) => x.errors.length).slice(0, 20)) {
      console.error(`  Row ${r.rowNumber}:`, r.errors);
    }
    process.exit(1);
  }

  console.log("\nAll rows valid. Committing -- this will take roughly a minute for the full dataset...");
  const start = Date.now();
  const result = await commitValidRows(preview.rows);
  console.log(`\nDone. Created ${result.created} polling stations in ${((Date.now() - start) / 1000).toFixed(1)}s.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
