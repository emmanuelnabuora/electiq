import Papa from "papaparse";
import { db } from "@/lib/db";
import { setPollingCenterLocation } from "@/lib/gis";

export const POLLING_STATION_CSV_COLUMNS = [
  "region_code",
  "constituency_code",
  "ward_code",
  "polling_center_code",
  "polling_center_name",
  "polling_station_code",
  "polling_station_name",
  "registered_voters",
  "latitude",
  "longitude",
] as const;

export type PollingStationCsvRow = Record<(typeof POLLING_STATION_CSV_COLUMNS)[number], string>;

export type ValidatedImportRow = {
  rowNumber: number; // 1-based, matches spreadsheet row (header is row 1)
  data: PollingStationCsvRow;
  errors: string[];
  resolvedWardId?: string;
  centerExists?: boolean;
};

export type ImportPreview = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: ValidatedImportRow[];
};

/** Parses CSV text into raw records. Malformed CSV structure itself becomes row-level errors, never a silent drop. */
export function parsePollingStationsCsv(csvText: string): {
  records: Record<string, string>[];
  parseErrors: string[];
} {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  return {
    records: result.data,
    parseErrors: result.errors.map((e) => `Row ${e.row ?? "?"}: ${e.message}`),
  };
}

/**
 * Validates every row against the existing administrative hierarchy and
 * against each other (duplicate detection within the file). Nothing here
 * writes to the database — this only produces the preview + error report
 * the person must confirm before anything is imported.
 */
export async function validatePollingStationsRows(
  records: Record<string, string>[]
): Promise<ImportPreview> {
  const seenStationCodes = new Set<string>();
  const rows: ValidatedImportRow[] = [];

  // Pre-load the full ward → constituency → region chain once instead of
  // querying per row.
  const wards = await db.administrativeUnit.findMany({
    where: { level: { depth: 2 } },
    include: { parent: { include: { parent: true } } },
  });
  const wardByChain = new Map(
    wards.map((w) => [
      `${w.parent?.parent?.code}::${w.parent?.code}::${w.code}`.toLowerCase(),
      w,
    ])
  );

  const existingStationCodes = new Set(
    (await db.pollingStation.findMany({ select: { code: true } })).map((s) => s.code)
  );

  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2; // +1 for 0-index, +1 for header row
    const raw = records[i] as Partial<PollingStationCsvRow>;
    const errors: string[] = [];

    for (const col of POLLING_STATION_CSV_COLUMNS) {
      const isOptional = col === "latitude" || col === "longitude";
      if (!isOptional && (!raw[col] || raw[col]!.trim() === "")) {
        errors.push(`Missing required value for "${col}"`);
      }
    }

    const data = raw as PollingStationCsvRow;

    let resolvedWardId: string | undefined;
    if (data.region_code && data.constituency_code && data.ward_code) {
      const key = `${data.region_code}::${data.constituency_code}::${data.ward_code}`.toLowerCase();
      const ward = wardByChain.get(key);
      if (!ward) {
        errors.push(
          `No ward "${data.ward_code}" under constituency "${data.constituency_code}" under region "${data.region_code}"`
        );
      } else {
        resolvedWardId = ward.id;
      }
    }

    if (data.registered_voters) {
      const n = Number(data.registered_voters);
      if (!Number.isInteger(n) || n < 0) {
        errors.push(`"registered_voters" must be a non-negative whole number, got "${data.registered_voters}"`);
      }
    }

    for (const [col, label] of [
      ["latitude", "Latitude"],
      ["longitude", "Longitude"],
    ] as const) {
      const v = data[col];
      if (v && v.trim() !== "" && Number.isNaN(Number(v))) {
        errors.push(`${label} must be a number, got "${v}"`);
      }
    }

    if (data.polling_station_code) {
      const code = data.polling_station_code.trim();
      if (existingStationCodes.has(code)) {
        errors.push(`Polling station code "${code}" already exists — bulk import only adds new stations`);
      }
      if (seenStationCodes.has(code.toLowerCase())) {
        errors.push(`Duplicate polling station code "${code}" within this file`);
      }
      seenStationCodes.add(code.toLowerCase());
    }

    const centerExists = !!(
      data.polling_center_code &&
      (await db.pollingCenter.findUnique({ where: { code: data.polling_center_code.trim() } }))
    );

    rows.push({ rowNumber, data, errors, resolvedWardId, centerExists });
  }

  const validRows = rows.filter((r) => r.errors.length === 0).length;

  return {
    totalRows: rows.length,
    validRows,
    errorRows: rows.length - validRows,
    rows,
  };
}

/**
 * Applies every valid row from a previously-created ImportJob. Invalid rows
 * are skipped — they were already surfaced in the preview and error report;
 * this never "fixes" or reinterprets them, it just doesn't apply them.
 */
export async function commitValidRows(rows: ValidatedImportRow[]): Promise<{ created: number }> {
  const validRows = rows.filter((r) => r.errors.length === 0 && r.resolvedWardId);
  let created = 0;

  for (const row of validRows) {
    const { data, resolvedWardId } = row;
    const centerCode = data.polling_center_code.trim();
    const lat = data.latitude ? Number(data.latitude) : null;
    const lng = data.longitude ? Number(data.longitude) : null;

    const center = await db.pollingCenter.upsert({
      where: { code: centerCode },
      update: {},
      create: {
        code: centerCode,
        name: data.polling_center_name.trim(),
        unitId: resolvedWardId!,
        latitude: lat,
        longitude: lng,
      },
    });

    if (lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
      await setPollingCenterLocation(center.id, lat, lng);
    }

    await db.pollingStation.create({
      data: {
        code: data.polling_station_code.trim(),
        name: data.polling_station_name.trim(),
        registeredVoters: Number(data.registered_voters),
        pollingCenterId: center.id,
      },
    });
    created++;
  }

  return { created };
}
