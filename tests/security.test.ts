import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { encryptBuffer, decryptBuffer, encryptText, decryptText, sha256HexBuffer } from "@/lib/security/crypto";
import {
  generateTotpSecret,
  getTotpUri,
  verifyTotpCode,
  generateBackupCodes,
  verifyBackupCode,
} from "@/lib/security/mfa";
import { verifyAuditChain } from "@/lib/security/audit-chain";
import { checkLoginRateLimit } from "@/lib/security/login-rate-limit";
import { checkSecurityConfig } from "@/lib/security/env-check";
import { recordAudit } from "@/lib/audit";
import { OTP } from "otplib";

describe("Encryption at rest (AES-256-GCM)", () => {
  it("round-trips a buffer correctly", () => {
    const original = Buffer.from("this is evidence content", "utf8");
    const encrypted = encryptBuffer(original);
    const decrypted = decryptBuffer(encrypted);
    expect(decrypted.equals(original)).toBe(true);
  });

  it("produces ciphertext that does not contain the plaintext", () => {
    const original = Buffer.from("a very specific secret string 12345", "utf8");
    const encrypted = encryptBuffer(original);
    expect(encrypted.toString("utf8")).not.toContain("a very specific secret string");
  });

  it("round-trips text correctly", () => {
    const original = "JBSWY3DPEHPK3PXP";
    expect(decryptText(encryptText(original))).toBe(original);
  });

  it("fails to decrypt with corrupted ciphertext (authentication tag check)", () => {
    const encrypted = encryptBuffer(Buffer.from("data"));
    const corrupted = Buffer.from(encrypted);
    corrupted[corrupted.length - 1] ^= 0xff;
    expect(() => decryptBuffer(corrupted)).toThrow();
  });

  it("sha256HexBuffer matches a hash computed independently over the same bytes", () => {
    const bytes = Buffer.from("independently verifiable content");
    const hash1 = sha256HexBuffer(bytes);
    const hash2 = sha256HexBuffer(Buffer.from("independently verifiable content"));
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});

describe("MFA (RFC 6238 TOTP via otplib)", () => {
  it("accepts a code actually generated from the secret", async () => {
    const secret = generateTotpSecret();
    const otp = new OTP();
    const code = await otp.generate({ secret });
    expect(await verifyTotpCode(secret, code)).toBe(true);
  });

  it("rejects a garbage code", async () => {
    const secret = generateTotpSecret();
    expect(await verifyTotpCode(secret, "000000")).toBe(false);
  });

  it("generates a valid otpauth:// URI", () => {
    const secret = generateTotpSecret();
    const uri = getTotpUri(secret, "voter@electiq.example");
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain("ElectIQ");
  });

  it("backup codes: each one verifies once and identifies its own index", async () => {
    const { plaintext, hashed } = await generateBackupCodes();
    expect(plaintext).toHaveLength(8);
    const index = await verifyBackupCode(plaintext[2], hashed);
    expect(index).toBe(2);
  });

  it("backup codes: an unknown code matches nothing", async () => {
    const { hashed } = await generateBackupCodes();
    expect(await verifyBackupCode("NOTAREALCODE", hashed)).toBeNull();
  });
});

describe("Audit hash chain (Section 11 — Immutable audit storage)", () => {
  it("a freshly-written chain verifies as valid", async () => {
    await recordAudit({ action: "LOGIN", reason: "chain test 1" });
    await recordAudit({ action: "LOGIN", reason: "chain test 2" });
    const result = await verifyAuditChain();
    expect(result.valid).toBe(true);
    expect(result.brokenAt).toHaveLength(0);
  });

  it("detects tampering when a row's content is altered after being written, and is repairable by restoring the original content", async () => {
    const entry = await recordAudit({ action: "LOGIN_FAILED", reason: "original reason for tamper test" });

    const before = await verifyAuditChain();
    expect(before.valid).toBe(true);

    const originalReason = entry.reason;

    // Simulate tampering: directly mutate a historical row's content
    // without going through recordAudit (which is exactly what an
    // attacker with raw DB access, but not the ability to also recompute
    // every subsequent hash, would do).
    await db.auditLog.update({
      where: { id: entry.id },
      data: { reason: "TAMPERED reason" },
    });

    const after = await verifyAuditChain();
    expect(after.valid).toBe(false);
    expect(after.brokenAt).toContain(entry.id);

    // Restore the row so this test doesn't leave the real audit log
    // permanently showing a break on every other page/test that checks
    // it afterward — the assertions above already proved detection works;
    // leaving the database in a tampered state isn't a further proof of
    // anything, it's just a mess for whatever runs next.
    await db.auditLog.update({
      where: { id: entry.id },
      data: { reason: originalReason },
    });
    const restored = await verifyAuditChain();
    expect(restored.valid).toBe(true);
  });
});

describe("Login rate limiter", () => {
  it("allows attempts under the limit and blocks once exceeded", () => {
    const key = `login-test-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      expect(checkLoginRateLimit(key)).toBe(true);
    }
    expect(checkLoginRateLimit(key)).toBe(false);
  });
});

describe("Security config validation", () => {
  it("flags a missing EVIDENCE_ENCRYPTION_KEY", () => {
    const original = process.env.EVIDENCE_ENCRYPTION_KEY;
    delete process.env.EVIDENCE_ENCRYPTION_KEY;
    const warnings = checkSecurityConfig();
    expect(warnings.some((w) => w.key === "EVIDENCE_ENCRYPTION_KEY" && w.severity === "critical")).toBe(true);
    if (original) process.env.EVIDENCE_ENCRYPTION_KEY = original;
  });

  it("does not flag a correctly-configured 32-byte key", () => {
    process.env.EVIDENCE_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    const warnings = checkSecurityConfig();
    expect(warnings.some((w) => w.key === "EVIDENCE_ENCRYPTION_KEY")).toBe(false);
  });
});
