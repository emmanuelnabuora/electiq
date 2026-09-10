import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

describe("Audit generation", () => {
  it("writes an audit row with the expected shape for a system-level event", async () => {
    const before = await db.auditLog.count();

    await recordAudit({
      action: "LOGIN_FAILED",
      reason: "vitest: no such user",
      ipAddress: "203.0.113.10",
    });

    const after = await db.auditLog.count();
    expect(after).toBe(before + 1);

    const latest = await db.auditLog.findFirst({ orderBy: { createdAt: "desc" } });
    expect(latest?.action).toBe("LOGIN_FAILED");
    expect(latest?.ipAddress).toBe("203.0.113.10");
    expect(latest?.actorId).toBeNull();
  });

  it("associates an audit row with an actor when one is provided", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { email: "admin@electiq.example" } });

    await recordAudit({ actorId: user.id, action: "LOGIN" });

    const latest = await db.auditLog.findFirst({
      where: { actorId: user.id, action: "LOGIN" },
      orderBy: { createdAt: "desc" },
    });
    expect(latest).not.toBeNull();
    expect(latest?.actorId).toBe(user.id);
  });
});
