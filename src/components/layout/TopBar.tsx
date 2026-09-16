import { db } from "@/lib/db";
import { TopBarElectionSelector } from "@/components/layout/TopBarElectionSelector";
import { SignOutButton } from "@/components/nav/sign-out-button";
import { ChevronDown } from "lucide-react";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export async function TopBar({ userName, userRoles }: { userName: string; userRoles: string[] }) {
  const elections = await db.election.findMany({
    orderBy: { electionDate: "desc" },
    select: { id: true, name: true, status: true, country: { select: { name: true } } },
  });
  const electionOptions = elections.map((e) => ({
    id: e.id,
    name: e.name,
    status: e.status,
    countryName: e.country.name,
  }));

  return (
    <header className="flex h-16 items-center justify-between border-b border-eiq-border bg-eiq-card px-6">
      <TopBarElectionSelector elections={electionOptions} />
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-eiq-blue text-xs font-semibold text-white">
            {initials(userName)}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium text-eiq-text-primary">{userName}</p>
            <p className="text-xs text-eiq-text-secondary">{userRoles[0] ?? ""}</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-eiq-text-secondary" />
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
