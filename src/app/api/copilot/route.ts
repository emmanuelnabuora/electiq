import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { askCopilot } from "@/lib/copilot/service";

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await authorize(session.user.id, "copilot", "use");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const result = await askCopilot({
      userId: session.user.id,
      conversationId: typeof body.conversationId === "string" ? body.conversationId : undefined,
      message,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "The Copilot could not process that question." },
      { status: 502 }
    );
  }
}
