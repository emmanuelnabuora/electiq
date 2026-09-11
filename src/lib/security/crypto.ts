import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

/**
 * Section 11: "Encryption at rest," "Secure evidence storage" — and its
 * own explicit rule, "never invent proprietary cryptography." This uses
 * AES-256-GCM via Node's built-in `crypto` module (a standard,
 * well-vetted, NIST-approved authenticated-encryption algorithm), not a
 * custom scheme. The key comes from `EVIDENCE_ENCRYPTION_KEY` — 32 raw
 * bytes, base64-encoded — and is never itself stored in the database.
 *
 * Ciphertext format: [12-byte IV][16-byte auth tag][ciphertext], all
 * concatenated into one buffer, so callers store a single blob rather
 * than three separate columns.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.EVIDENCE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "EVIDENCE_ENCRYPTION_KEY is not configured — cannot encrypt or decrypt evidence at rest."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("EVIDENCE_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).");
  }
  return key;
}

export function encryptBuffer(plaintext: Buffer): Buffer {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptBuffer(encrypted: Buffer): Buffer {
  const key = getKey();
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Convenience wrappers for short text values (e.g. a TOTP secret) rather than file buffers. */
export function encryptText(plaintext: string): string {
  return encryptBuffer(Buffer.from(plaintext, "utf8")).toString("base64");
}

export function decryptText(encryptedBase64: string): string {
  return decryptBuffer(Buffer.from(encryptedBase64, "base64")).toString("utf8");
}

/** SHA-256 hex digest of a string — used for the audit hash chain, not for anything requiring a keyed/salted hash. */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** SHA-256 hex digest of raw bytes — used for evidence integrity (Section 13), so it matches a standard `sha256sum` of the original file for independent verification. */
export function sha256HexBuffer(input: Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}
