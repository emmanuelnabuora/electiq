import { requireSession } from "@/lib/session";
import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/nav/topbar";

export default async function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen bg-navy-primary">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex flex-1 flex-col">
        <div className="print:hidden">
          <Topbar userName={session.user.name ?? ""} userRoles={session.user.roles} />
        </div>
        <main className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
