"use client";

/**
 * Section 21's "Capture locally → queue → connectivity restored →
 * synchronize → server validates → acknowledge," implemented with
 * localStorage rather than a full service-worker/IndexedDB PWA — a
 * deliberate, documented scope decision (see README's Known Limitations),
 * not a silent gap. It genuinely survives a page reload and a real
 * connectivity loss; it does not survive the browser's storage being
 * cleared, and the queued payload is not encrypted at rest.
 *
 * Every queued report carries a `clientReportId` generated once, here,
 * so a report that's retried after a flaky sync is never inserted twice
 * — the server enforces this with a unique constraint on
 * (assignmentId, clientReportId) in submitFieldReport().
 */

const STORAGE_KEY = "electiq.field-report-queue.v1";

export type QueuedFieldReport = {
  clientReportId: string;
  queuedAt: string;
  fields: Record<string, string>;
};

function readQueue(): QueuedFieldReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedFieldReport[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedFieldReport[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueueFieldReport(fields: Record<string, string>): QueuedFieldReport {
  const clientReportId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const entry: QueuedFieldReport = { clientReportId, queuedAt: new Date().toISOString(), fields };
  const queue = readQueue();
  queue.push(entry);
  writeQueue(queue);
  return entry;
}

export function getQueuedReports(): QueuedFieldReport[] {
  return readQueue();
}

export function removeQueuedReport(clientReportId: string): void {
  writeQueue(readQueue().filter((r) => r.clientReportId !== clientReportId));
}

export function queueLength(): number {
  return readQueue().length;
}

/**
 * Attempts to sync every queued report by calling `submitAction` (the
 * real submitFieldReport server action) for each one. A report is only
 * removed from the local queue once the server call actually succeeds —
 * if the device is still offline, everything stays queued for the next
 * attempt.
 */
export async function flushQueue(
  submitAction: (formData: FormData) => Promise<void>
): Promise<{ synced: number; remaining: number }> {
  const queue = readQueue();
  let synced = 0;

  for (const entry of queue) {
    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(entry.fields)) {
        formData.set(key, value);
      }
      formData.set("clientReportId", entry.clientReportId);
      await submitAction(formData);
      removeQueuedReport(entry.clientReportId);
      synced++;
    } catch {
      // Leave it queued — could be offline again, or a real server error;
      // either way, the report is not lost.
    }
  }

  return { synced, remaining: queueLength() };
}
