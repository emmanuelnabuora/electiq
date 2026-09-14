/**
 * Transforms the raw IEBC-style polling-station reference CSV into the
 * exact column format ElectIQ's own import page
 * (/command-center/polling-stations/import) expects.
 *
 * Deliberately does NOT invent registered_voters, latitude, or
 * longitude — the source file has none of these, and a plausible-looking
 * fabricated number for a real polling station's voter count is worse
 * than an honest blank. `registered_voters` is a hard requirement in
 * ElectIQ's importer (blank rows will correctly fail validation until
 * filled in with real figures); `latitude`/`longitude` are optional
 * there, so leaving them blank lets the import succeed without GPS
 * coordinates — but the map/GIS features won't have anything to plot
 * for these stations until real coordinates are added.
 *
 * There is also no "polling center" concept in the source data (it has
 * one code/name per row, not a separate center-then-station split).
 * Real IEBC data usually has multiple streams per physical center; since
 * this file doesn't indicate that grouping, each row is mapped to its
 * own single-station center rather than guessing which stations might
 * share a location.
 *
 * Usage:
 *   npx tsx scripts/transform-kenya-polling-stations.ts \
 *     scripts/kenya-polling-stations-source.csv \
 *     scripts/kenya-polling-stations-import-ready.csv
 */
import { readFileSync, writeFileSync } from "fs";
import Papa from "papaparse";

type SourceRow = {
  County_code: string;
  Const_code: string;
  CAW_Code: string;
  PS_Code: string;
  PS_Name: string;
};

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error(
      "Usage: npx tsx scripts/transform-kenya-polling-stations.ts <source.csv> <output.csv>"
    );
    process.exit(1);
  }

  const csvText = readFileSync(inputPath, "utf-8");
  const { data, errors } = Papa.parse<SourceRow>(csvText, { header: true, skipEmptyLines: true });
  if (errors.length > 0) {
    console.error("CSV parse errors:", errors);
    process.exit(1);
  }

  const rows = data.filter((r) => r.County_code);

  const outputRows = rows.map((r) => ({
    region_code: r.County_code,
    constituency_code: r.Const_code,
    ward_code: r.CAW_Code,
    polling_center_code: r.PS_Code,
    polling_center_name: r.PS_Name,
    polling_station_code: r.PS_Code,
    polling_station_name: r.PS_Name,
    registered_voters: "",
    latitude: "",
    longitude: "",
  }));

  const csv = Papa.unparse(outputRows, { columns: Object.keys(outputRows[0]) });
  writeFileSync(outputPath, csv);

  console.log(`Wrote ${outputRows.length} rows to ${outputPath}.`);
  console.log(
    "\nregistered_voters, latitude, and longitude are blank for every row — intentional, not a bug."
  );
  console.log(
    "registered_voters is REQUIRED by the importer — every row will fail until you fill it in with"
  );
  console.log(
    "real voter-register data. latitude/longitude are optional there — the import can succeed"
  );
  console.log(
    "without them, but the Election Map and GIS features won't have anything to plot for these"
  );
  console.log("stations until real coordinates are added.");
}

main();
