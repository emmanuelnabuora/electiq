import { createHash } from "crypto";
import { db } from "@/lib/db";

/**
 * Evidence Vault storage, scoped to result documents for Sprint 3. File
 * bytes live in Postgres (`ResultDocument.content`) behind this narrow
 * interface rather than scattered `db.resultDocument.create()` calls, so
 * swapping to an S3-compatible backend later (Section 4) only means
 * changing this file, not every call site. Section 13 is explicit that
 * evidence identity must never rely on filename — every document gets a
 * computed SHA-256 here, not one supplied by the client.
 */
export async function storeResultDocument(params: {
  submissionId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  uploadedById?: string;
}) {
  const sha256 = createHash("sha256").update(params.bytes).digest("hex");

  return db.resultDocument.create({
    data: {
      submissionId: params.submissionId,
      fileName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.bytes.byteLength,
      sha256,
      content: new Uint8Array(params.bytes),
      uploadedById: params.uploadedById,
    },
  });
}

export async function getResultDocument(id: string) {
  return db.resultDocument.findUnique({ where: { id } });
}
