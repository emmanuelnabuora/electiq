"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { requireSession } from "@/lib/session";
import { ActionError } from "@/lib/actions/errors";
import { Prisma } from "@/generated/prisma/client";
import {
  generateTotpSecret,
  getTotpUri,
  verifyTotpCode,
  encryptTotpSecret,
  generateBackupCodes,
} from "@/lib/security/mfa";

/**
 * Step 1 of enrollment: generate a fresh TOTP secret and its QR code.
 * Nothing is persisted yet — the secret only becomes real once the user
 * proves they can generate a valid code from it (confirmMfaEnrollment).
 * This is why the secret is returned to the client at this stage: the
 * next call must be able to send it back for verification.
 */
export async function startMfaEnrollment(): Promise<{ secret: string; qrCodeDataUrl: string }> {
  const session = await requireSession();
  const secret = generateTotpSecret();
  const uri = getTotpUri(secret, session.user.email ?? session.user.name ?? "user");
  const qrCodeDataUrl = await QRCode.toDataURL(uri);
  return { secret, qrCodeDataUrl };
}

export async function confirmMfaEnrollment(formData: FormData): Promise<{ backupCodes: string[] }> {
  const session = await requireSession();
  const secret = String(formData.get("secret") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!secret || !code) throw new ActionError("Secret and code are required");
  if (!(await verifyTotpCode(secret, code))) {
    throw new ActionError("That code doesn't match — check your authenticator app and try again");
  }

  const { plaintext, hashed } = await generateBackupCodes();

  await db.user.update({
    where: { id: session.user.id },
    data: {
      mfaEnabled: true,
      mfaSecretEncrypted: encryptTotpSecret(secret),
      mfaBackupCodesHashed: hashed,
    },
  });

  await recordAudit({ actorId: session.user.id, action: "MFA_ENABLED" });

  return { backupCodes: plaintext };
}

export async function disableMfa(formData: FormData): Promise<void> {
  const session = await requireSession();
  const password = String(formData.get("password") ?? "");

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new ActionError("Incorrect password");
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaBackupCodesHashed: Prisma.JsonNull },
  });

  await recordAudit({ actorId: session.user.id, action: "MFA_DISABLED" });
}
