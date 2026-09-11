import { OTP, generateSecret as otpGenerateSecret } from "otplib";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { encryptText, decryptText } from "@/lib/security/crypto";

/**
 * Section 11: "MFA." Uses `otplib` v13's standard RFC 6238 TOTP
 * implementation via its `OTP` class (default strategy) — the same
 * algorithm Google Authenticator, Authy, and every major MFA app use,
 * never a custom one-time-password scheme.
 */

const otp = new OTP();
const BACKUP_CODE_COUNT = 8;

export function generateTotpSecret(): string {
  return otpGenerateSecret();
}

export function getTotpUri(secret: string, email: string): string {
  return otp.generateURI({ issuer: "ElectIQ", label: email, secret });
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const result = await otp.verify({ secret, token: code });
  return result.valid;
}

export function encryptTotpSecret(secret: string): string {
  return encryptText(secret);
}

export function decryptTotpSecret(encrypted: string): string {
  return decryptText(encrypted);
}

/** Generates fresh backup codes (returned once, in plaintext, for the user to save) plus their bcrypt hashes (what actually gets stored). */
export async function generateBackupCodes(): Promise<{ plaintext: string[]; hashed: string[] }> {
  const plaintext = Array.from({ length: BACKUP_CODE_COUNT }, () =>
    randomBytes(5).toString("hex").toUpperCase()
  );
  const hashed = await Promise.all(plaintext.map((code) => bcrypt.hash(code, 10)));
  return { plaintext, hashed };
}

/** Checks a submitted backup code against the stored hashes, returning the index consumed (or null if it doesn't match any). Callers must remove the consumed hash so each backup code works only once. */
export async function verifyBackupCode(code: string, hashedCodes: string[]): Promise<number | null> {
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(code.trim().toUpperCase(), hashedCodes[i])) {
      return i;
    }
  }
  return null;
}
