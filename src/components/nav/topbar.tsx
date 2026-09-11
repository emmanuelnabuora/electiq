import { db } from "@/lib/db";
import { Search, Bell } from "lucide-react";
import { ElectionSelector } from "@/components/nav/election-selector";
import { SystemStatus } from "@/components/nav/system-status";
import { SignOutButton } from "@/components/nav/sign-out-button";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export async function Topbar({
  userName,
  userRoles,
}: {
  userName: string;
  userRoles: string[];
}) {
  // Ordered by electionDate, not createdAt — insertion order isn't
  // chronological order once a historical election exists (see
  // src/lib/elections/current.ts), and the selector's default (the first
  // item when no ?electionId= is set) must be the actual current
  // election, not whichever one happened to be seeded last.
  const elections = await db.election.findMany({
    orderBy: { electionDate: "desc" },
    select: { id: true, name: true, status: true },
  });

  return (
    <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-3">
      <div className="flex items-center gap-3">
        {elections.length > 0 && <ElectionSelector elections={elections} />}
      </div>

      <div className="flex items-center gap-4">
        <SystemStatus />

        <div className="flex items-center gap-1 border-l border-white/10 pl-4">
          <span
            title="Universal search arrives in a later sprint (Section 22)"
            className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-neutral/50"
          >
            <Search className="h-4 w-4" />
          </span>
          <span
            title="Notifications arrive in a later sprint (Section 23)"
            className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-neutral/50"
          >
            <Bell className="h-4 w-4" />
          </span>
        </div>

        <div className="flex items-center gap-2.5 border-l border-white/10 pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-xs font-medium text-accent">
            {initials(userName)}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-tight text-light">{userName}</p>
            <p className="text-xs leading-tight text-neutral">{userRoles.join(", ")}</p>
          </div>
        </div>

        <SignOutButton />
      </div>
    </header>
  );
}
