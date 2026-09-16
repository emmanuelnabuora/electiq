import type { ReactNode } from "react";
import { requireSession } from "@/lib/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen bg-eiq-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <TopBar userName={session.user.name ?? ""} userRoles={session.user.roles} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
