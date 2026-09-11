import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { decryptBuffer } from "@/lib/security/crypto";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await authorize(session.user.id, "incidents", "read");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await db.incidentEvidence.findUnique({ where: { id: params.id } });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const decrypted = decryptBuffer(Buffer.from(doc.content));

  return new NextResponse(new Uint8Array(decrypted), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.fileName}"`,
      "Content-Length": String(doc.sizeBytes),
    },
  });
}
