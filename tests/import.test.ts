import { describe, it, expect } from "vitest";
import { parsePollingStationsCsv, validatePollingStationsRows } from "@/lib/import/polling-stations";

const VALID_ROW =
  "REG-1,REG1-CON1,REG1-CON1-WRD1,REG1-CON1-WRD1-PC1,Polling Center 1,REG1-CON1-WRD1-PC1-PS99,New Station,900,-1.22,35.65";

const HEADER =
  "region_code,constituency_code,ward_code,polling_center_code,polling_center_name,polling_station_code,polling_station_name,registered_voters,latitude,longitude";

describe("Bulk import — polling stations CSV", () => {
  it("parses a well-formed CSV into records", () => {
    const { records, parseErrors } = parsePollingStationsCsv(`${HEADER}\n${VALID_ROW}`);
    expect(parseErrors).toHaveLength(0);
    expect(records).toHaveLength(1);
    expect(records[0].polling_station_code).toBe("REG1-CON1-WRD1-PC1-PS99");
  });

  it("accepts a row that resolves to a real, existing ward in the seeded geography", async () => {
    const { records } = parsePollingStationsCsv(`${HEADER}\n${VALID_ROW}`);
    const preview = await validatePollingStationsRows(records);
    expect(preview.validRows).toBe(1);
    expect(preview.errorRows).toBe(0);
    expect(preview.rows[0].resolvedWardId).toBeTruthy();
  });

  it("flags a row referencing a region/constituency/ward combination that doesn't exist", async () => {
    const badRow = VALID_ROW.replace("REG-1", "REG-999");
    const { records } = parsePollingStationsCsv(`${HEADER}\n${badRow}`);
    const preview = await validatePollingStationsRows(records);
    expect(preview.errorRows).toBe(1);
    expect(preview.rows[0].errors.some((e) => e.includes("No ward"))).toBe(true);
  });

  it("flags a polling station code that already exists in the database", async () => {
    // REG1-CON1-WRD1-PC1-PS1 is created by the seed script.
    const dupRow = VALID_ROW.replace("REG1-CON1-WRD1-PC1-PS99", "REG1-CON1-WRD1-PC1-PS1");
    const { records } = parsePollingStationsCsv(`${HEADER}\n${dupRow}`);
    const preview = await validatePollingStationsRows(records);
    expect(preview.errorRows).toBe(1);
    expect(preview.rows[0].errors.some((e) => e.includes("already exists"))).toBe(true);
  });

  it("flags a non-numeric registered_voters value rather than silently coercing it", async () => {
    const badRow = VALID_ROW.replace(",900,", ",not-a-number,");
    const { records } = parsePollingStationsCsv(`${HEADER}\n${badRow}`);
    const preview = await validatePollingStationsRows(records);
    expect(preview.errorRows).toBe(1);
    expect(preview.rows[0].errors.some((e) => e.includes("registered_voters"))).toBe(true);
  });

  it("flags duplicate polling station codes within the same file", async () => {
    const { records } = parsePollingStationsCsv(`${HEADER}\n${VALID_ROW}\n${VALID_ROW}`);
    const preview = await validatePollingStationsRows(records);
    expect(preview.totalRows).toBe(2);
    expect(preview.rows[1].errors.some((e) => e.includes("Duplicate"))).toBe(true);
  });

  it("flags missing required fields instead of silently dropping the row", async () => {
    const incompleteRow = ",,,,,,,,,"; // every column blank
    const { records } = parsePollingStationsCsv(`${HEADER}\n${incompleteRow}`);
    const preview = await validatePollingStationsRows(records);
    expect(preview.rows[0].errors.length).toBeGreaterThan(0);
  });
});
