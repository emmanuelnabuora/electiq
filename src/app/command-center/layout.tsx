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
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar userName={session.user.name ?? ""} userRoles={session.user.roles} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
