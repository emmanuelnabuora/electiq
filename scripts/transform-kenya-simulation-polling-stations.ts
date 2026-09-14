/**
 * Transforms SIMULATION_POLLING_STATIONS_Final_-_v2_0.xlsx into ElectIQ's
 * exact import-page column format.
 *
 * IMPORTANT — read before running this against a real deployment:
 * "VOTERS PER POLLING STATION" in the source workbook is SIMULATED data,
 * not real IEBC voter-register figures — the filename says so, and the
 * numbers themselves confirm it (every one of 580 stations falls in a
 * suspiciously narrow, evenly-distributed 500-700 range; real per-station
 * registered-voter counts vary far more than that). This script carries
 * that number through as-is, at the person's explicit request, as a
 * temporary placeholder while the real official list is pending — it
 * does not invent anything beyond what's already in the source file.
 *
 * Every row's polling_center_name is prefixed with "[SIMULATED DATA]" so
 * anyone looking at the imported stations in ElectIQ (not just whoever
 * ran this script) can tell at a glance that these figures are
 * placeholders, not the certified voter register. Remove that prefix
 * (and re-import with real numbers) once the final list arrives.
 *
 * Usage:
 *   npx tsx scripts/transform-kenya-simulation-polling-stations.ts \
 *     scripts/SIMULATION_POLLING_STATIONS_Final_-_v2_0.xlsx \
 *     scripts/kenya-simulation-import-ready.csv
 */
import { writeFileSync } from "fs";
import * as XLSX from "xlsx";
import Papa from "papaparse";

type SourceRow = {
  "COUNTY CODE": number | string;
  "CONSTITUENCY CODE": number | string;
  "CAW CODE": number | string;
  "REGISTRATION CENTRE NAME": string;
  "POLLING STATION CODE": number | string;
  "POLLING STATION NAME": string;
  "VOTERS PER POLLING STATION": number | string;
  "Polling Centre Code": number | string;
};

function pad(value: number | string, width: number): string {
  return String(value).trim().padStart(width, "0");
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error(
      "Usage: npx tsx scripts/transform-kenya-simulation-polling-stations.ts <source.xlsx> <output.csv>"
    );
    process.exit(1);
  }

  const workbook = XLSX.readFile(inputPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<SourceRow>(sheet);

  const outputRows = rows.map((r) => ({
    region_code: pad(r["COUNTY CODE"], 3),
    constituency_code: pad(r["CONSTITUENCY CODE"], 3),
    ward_code: pad(r["CAW CODE"], 4),
    polling_center_code: String(r["Polling Centre Code"]).trim(),
    polling_center_name: `[SIMULATED DATA] ${String(r["REGISTRATION CENTRE NAME"]).trim()}`,
    polling_station_code: String(r["POLLING STATION CODE"]).trim(),
    polling_station_name: String(r["POLLING STATION NAME"]).trim(),
    registered_voters: String(r["VOTERS PER POLLING STATION"]).trim(),
    latitude: "",
    longitude: "",
  }));

  const csv = Papa.unparse(outputRows, { columns: Object.keys(outputRows[0]) });
  writeFileSync(outputPath, csv);

  console.log(`Wrote ${outputRows.length} rows to ${outputPath}.`);
  console.log("\n*** registered_voters in this file is SIMULATED data, not real. ***");
  console.log('Every polling_center_name is prefixed "[SIMULATED DATA]" so this is visible');
  console.log("inside ElectIQ itself, not just in this script's output. Replace this entire");
  console.log("import once the official voter list is available.");
}

main();
