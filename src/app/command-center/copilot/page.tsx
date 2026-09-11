import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { CopilotChat } from "@/components/copilot/copilot-chat";

export default async function CopilotPage() {
  const session = await requireSession();
  const canUse = await authorize(session.user.id, "copilot", "use");

  if (!canUse) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-neutral">
          Your role does not include permission to use the Copilot (<code>copilot.use</code>).
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-light">ElectIQ Copilot</h1>
        <p className="text-sm text-neutral">
          Permission-aware election intelligence — grounded in your own access, never invents figures.
        </p>
      </div>
      <CopilotChat />
    </div>
  );
}
