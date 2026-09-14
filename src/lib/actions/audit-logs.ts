"use server";

import { db } from "@/lib/db";
import { authorize } from "@/lib/rbac";
import { requireSession } from "@/lib/session";
import { ActionError } from "@/lib/actions/errors";
import type { AuditAction } from "@/generated/prisma/client";

const PAGE_SIZE = 50;

export async function listAuditLogs(params: {
  page?: number;
  action?: AuditAction;
  actorId?: string;
}) {
  const session = await requireSession();
  const allowed = await authorize(session.user.id, "audit", "read");
  if (!allowed) throw new ActionError("You don't have permission to view audit logs.");

  const page = Math.max(1, params.page ?? 1);
  const where = {
    ...(params.action ? { action: params.action } : {}),
    ...(params.actorId ? { actorId: params.actorId } : {}),
  };

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
    db.auditLog.count({ where }),
  ]);

  return { rows, total, page, pageSize: PAGE_SIZE, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listAuditActorsAndActions() {
  const session = await requireSession();
  const allowed = await authorize(session.user.id, "audit", "read");
  if (!allowed) throw new ActionError("You don't have permission to view audit logs.");

  const [actors, actions] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.auditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);

  return { actors, actions: actions.map((a) => a.action) };
}
