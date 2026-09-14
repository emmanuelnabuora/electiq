"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { authorize } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { ActionError } from "@/lib/actions/errors";
import { generateApiKey } from "@/lib/security/api-keys";

async function requireApiKeyManagement() {
  const session = await requireSession();
  const allowed = await authorize(session.user.id, "users", "manage");
  if (!allowed) throw new ActionError("You don't have permission to manage API keys.");
  return session;
}

export async function listApiKeys() {
  await requireApiKeyManagement();
  return db.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
      createdBy: { select: { name: true } },
    },
  });
}

export async function createApiKey(formData: FormData) {
  const session = await requireApiKeyManagement();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new ActionError("Give the key a name so it's identifiable later.");

  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  await db.apiKey.create({
    data: { name, keyHash, keyPrefix, createdById: session.user.id },
  });

  await recordAudit({
    action: "API_KEY_CREATED",
    actorId: session.user.id,
    reason: `Created API key "${name}"`,
  });

  revalidatePath("/command-center/api-management");
  return { rawKey };
}

export async function revokeApiKey(formData: FormData) {
  const session = await requireApiKeyManagement();
  const keyId = String(formData.get("keyId") ?? "");

  const key = await db.apiKey.findUniqueOrThrow({ where: { id: keyId } });
  await db.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });

  await recordAudit({
    action: "API_KEY_REVOKED",
    actorId: session.user.id,
    reason: `Revoked API key "${key.name}"`,
  });

  revalidatePath("/command-center/api-management");
}
