import { db } from "@/lib/db";
import { sha256HexBuffer, encryptBuffer, decryptBuffer } from "@/lib/security/crypto";

/**
 * Evidence Vault storage, scoped to result documents. File bytes live in
 * Postgres (`ResultDocument.content`) behind this narrow interface rather
 * than scattered `db.resultDocument.create()` calls, so swapping to an
 * S3-compatible backend later (Section 4) only means changing this file,
 * not every call site. Section 13 is explicit that evidence identity
 * must never rely on filename — every document gets a computed SHA-256
 * here, not one supplied by the client.
 *
 * Sprint 11 adds encryption at rest (Section 11): the SHA-256 is computed
 * over the original plaintext (so it verifies against the actual file
 * content, independent of how it's stored), and only the encrypted bytes
 * (AES-256-GCM, src/lib/security/crypto.ts) are written to the database.
 * getResultDocument() transparently decrypts before returning.
 */
export async function storeResultDocument(params: {
  submissionId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  uploadedById?: string;
}) {
  const sha256 = sha256HexBuffer(params.bytes);
  const encrypted = encryptBuffer(params.bytes);

  return db.resultDocument.create({
    data: {
      submissionId: params.submissionId,
      fileName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.bytes.byteLength,
      sha256,
      content: new Uint8Array(encrypted),
      uploadedById: params.uploadedById,
    },
  });
}

export async function getResultDocument(id: string) {
  const doc = await db.resultDocument.findUnique({ where: { id } });
  if (!doc) return null;
  const decrypted = decryptBuffer(Buffer.from(doc.content));
  return { ...doc, content: new Uint8Array(decrypted) };
}

/**
 * Same content-addressed, encrypted-at-rest pattern as
 * storeResultDocument -- candidate nomination paperwork (proof of
 * eligibility, party endorsement letters) can carry sensitive personal
 * information, so it gets the same treatment as result evidence
 * rather than a lighter-weight path just because it's a different
 * entity type.
 */
export async function storeCandidateDocument(params: {
  candidateId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  uploadedById?: string;
}) {
  const sha256 = sha256HexBuffer(params.bytes);
  const encrypted = encryptBuffer(params.bytes);

  return db.candidateDocument.create({
    data: {
      candidateId: params.candidateId,
      fileName: params.fileName,
      mimeType: params.mimeType,
      sizeBytes: params.bytes.byteLength,
      sha256,
      content: new Uint8Array(encrypted),
      uploadedById: params.uploadedById,
    },
  });
}

export async function getCandidateDocument(id: string) {
  const doc = await db.candidateDocument.findUnique({ where: { id } });
  if (!doc) return null;
  const decrypted = decryptBuffer(Buffer.from(doc.content));
  return { ...doc, content: new Uint8Array(decrypted) };
}
