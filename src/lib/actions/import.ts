"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { ActionError } from "@/lib/actions/errors";
import {
  parsePollingStationsCsv,
  validatePollingStationsRows,
  commitValidRows,
  type ValidatedImportRow,
} from "@/lib/import/polling-stations";

export type ImportPreviewResult = {
  jobId: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: ValidatedImportRow[];
};

/** Upload → Parse → Validate → Preview. Nothing is written to polling infrastructure yet — only the ImportJob record itself. */
export async function previewPollingStationImport(formData: FormData): Promise<ImportPreviewResult> {
  const session = await requireSession();
  await requirePermission(session.user.id, "geography", "manage");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new ActionError("No file was uploaded");
  }
  if (file.size === 0) {
    throw new ActionError("The uploaded file is empty");
  }

  const csvText = await file.text();
  const { records, parseErrors } = parsePollingStationsCsv(csvText);

  if (records.length === 0 && parseErrors.length === 0) {
    throw new ActionError("No data rows found in the file — check it has a header row plus at least one data row");
  }

  const preview = await validatePollingStationsRows(records);

  // Structural CSV parse errors (e.g. a malformed line) are folded in as
  // their own error rows so the error report is complete, not partial.
  const rows: ValidatedImportRow[] = [
    ...preview.rows,
    ...parseErrors.map((message, i) => ({
      rowNumber: preview.rows.length + i + 2,
      data: {} as ValidatedImportRow["data"],
      errors: [message],
    })),
  ];
  const totalRows = rows.length;
  const validRows = rows.filter((r) => r.errors.length === 0).length;
  const errorRows = totalRows - validRows;

  const job = await db.importJob.create({
    data: {
      entityType: "POLLING_STATIONS",
      status: "PENDING_CONFIRMATION",
      fileName: file.name,
      totalRows,
      validRows,
      errorRows,
      rawRows: rows,
      createdById: session.user.id,
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "IMPORT_STARTED",
    entityType: "ImportJob",
    entityId: job.id,
    newState: { fileName: file.name, totalRows, validRows, errorRows },
  });

  return { jobId: job.id, fileName: file.name, totalRows, validRows, errorRows, rows };
}

/** Confirm → Import → Audit. Applies exactly the valid rows captured at preview time. */
export async function confirmPollingStationImport(jobId: string): Promise<{ created: number }> {
  const session = await requireSession();
  await requirePermission(session.user.id, "geography", "manage");

  const job = await db.importJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.status !== "PENDING_CONFIRMATION") {
    throw new ActionError(`This import is already ${job.status.toLowerCase()}`);
  }

  const rows = job.rawRows as unknown as ValidatedImportRow[];
  const { created } = await commitValidRows(rows);

  // Persist the per-row error report permanently for audit/trace purposes.
  const errorRows = rows.filter((r) => r.errors.length > 0);
  if (errorRows.length > 0) {
    await db.importError.createMany({
      data: errorRows.map((r) => ({
        importJobId: job.id,
        rowNumber: r.rowNumber,
        message: r.errors.join("; "),
        rawRow: r.data,
        unitId: r.resolvedWardId ?? null,
      })),
    });
  }

  await db.importJob.update({
    where: { id: job.id },
    data: { status: "IMPORTED", completedAt: new Date() },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "IMPORT_CONFIRMED",
    entityType: "ImportJob",
    entityId: job.id,
    newState: { created, skipped: errorRows.length },
  });

  revalidatePath("/polling-stations");
  return { created };
}

export async function cancelPollingStationImport(jobId: string): Promise<void> {
  const session = await requireSession();
  await requirePermission(session.user.id, "geography", "manage");

  const job = await db.importJob.findUniqueOrThrow({ where: { id: jobId } });
  if (job.status !== "PENDING_CONFIRMATION") {
    throw new ActionError(`This import is already ${job.status.toLowerCase()}`);
  }

  await db.importJob.update({ where: { id: job.id }, data: { status: "CANCELLED" } });

  await recordAudit({
    actorId: session.user.id,
    action: "IMPORT_CANCELLED",
    entityType: "ImportJob",
    entityId: job.id,
  });
}
