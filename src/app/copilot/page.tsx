import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/session";
import { authorize } from "@/lib/rbac";
import { CopilotChat } from "@/components/copilot/copilot-chat";

/**
 * Moved here from /command-center/copilot as part of the master-spec
 * redesign. CopilotChat itself is not restyled internally -- checked
 * its real backend (src/lib/copilot/service.ts) directly before
 * moving anything: it's a genuine tool-use architecture with an
 * explicit system-prompt instruction never to invent figures and to
 * say plainly when a tool returns nothing, exactly what the master
 * spec requires, not something built for this pass. Its example
 * questions were updated to match the master spec's suggested
 * questions exactly (a safe, text-only change).
 */
export default async function CopilotPage() {
  const session = await requireSession();
  const canUse = await authorize(session.user.id, "copilot", "use");

  if (!canUse) {
    return (
      <AppShell>
        <PageHeader title="ElectIQ Copilot" />
        <p className="text-sm text-eiq-text-secondary">
          Your role does not include permission to use the Copilot (copilot.use).
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="ElectIQ Copilot"
        subtitle="Permission-aware election intelligence -- grounded in your own access, never invents figures."
      />
      <div className="mx-auto max-w-3xl">
        <CopilotChat />
      </div>
    </AppShell>
  );
}
