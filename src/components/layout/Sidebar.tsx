"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Vote,
  BarChart3,
  MapPinned,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  ScrollText,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Elections", href: "/elections", icon: Vote },
  { label: "Results", href: "/results", icon: BarChart3 },
  { label: "Field Operations", href: "/field-operations", icon: MapPinned },
  { label: "Incidents", href: "/incidents", icon: ShieldAlert },
  { label: "Integrity", href: "/integrity", icon: ShieldCheck },
  { label: "Users & Roles", href: "/users", icon: UsersRound },
  { label: "Audit Logs", href: "/audit-logs", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col bg-eiq-sidebar text-white/80">
      <div className="flex items-center gap-2 px-5 py-5">
        <ShieldCheck className="h-5 w-5 text-eiq-blue" />
        <span className="text-base font-semibold text-white">ElectIQ</span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-eiq-sidebar-active text-white"
                  : "text-white/70 hover:bg-eiq-sidebar-hover hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
