import Link from "next/link";
import {
  LayoutDashboard,
  Vote,
  Users2,
  Flag,
  MapPin,
  BarChart3,
  Radar,
  ShieldAlert,
  MapPinned,
  Eye,
  ClipboardList,
  Sparkles,
  History,
  FlaskConical,
  Vault,
  CheckSquare,
  ScrollText,
  FileText,
  Globe,
  Plug,
  UserCog,
  KeyRound,
  Settings,
} from "lucide-react";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  sprint?: number; // set when the feature does not exist yet
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    title: "Command",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    title: "Election",
    items: [
      { label: "Elections", href: "/elections", icon: Vote },
      { label: "Candidates", href: "/elections", icon: Users2 },
      { label: "Parties", href: "/elections", icon: Flag },
      { label: "Polling Stations", href: "/command-center/polling-stations", icon: MapPin },
      { label: "Results", href: "/results", icon: BarChart3 },
      { label: "Turnout", href: "/turnout", icon: Radar },
      { label: "Election Map", href: "/election-map", icon: Globe },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Field Operations", href: "/field-operations", icon: MapPinned },
      { label: "Incidents", href: "/incidents", icon: ShieldAlert },
      { label: "Observers", href: "/field-operations/assignments", icon: Eye },
      { label: "Field Reports", href: "/field-operations/assignments", icon: ClipboardList },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Analytics", href: "/command-center/analytics", icon: BarChart3 },
      { label: "ElectIQ Copilot", href: "/command-center/copilot", icon: Sparkles },
      { label: "Integrity Alerts", href: "/integrity", icon: ShieldAlert },
      { label: "Historical Analytics", href: "/command-center/analytics", icon: History },
      { label: "Scenario Lab", href: "/command-center/scenarios", icon: FlaskConical },
    ],
  },
  {
    title: "Assurance",
    items: [
      { label: "Evidence Vault", href: "/results/submissions", icon: Vault },
      { label: "Verification", href: "/results/submissions", icon: CheckSquare },
      { label: "Audit Logs", href: "/command-center/audit-logs", icon: ScrollText },
    ],
  },
  {
    title: "Reporting",
    items: [{ label: "Reports", href: "/command-center/reports", icon: FileText }],
  },
  {
    title: "Publication",
    items: [
      { label: "Public Portal", href: "/public", icon: Globe },
      { label: "API Management", href: "/api-management", icon: Plug },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", href: "/users", icon: UserCog },
      { label: "Roles", href: "/users/roles", icon: KeyRound },
      { label: "Permissions", href: "/users/permissions", icon: KeyRound },
      { label: "System Settings", href: "/command-center/security", icon: Settings },
    ],
  },
];

export function Sidebar() {
  return (
    <nav className="flex h-screen w-64 flex-col overflow-y-auto border-r border-white/10 bg-navy-secondary px-3 py-4">
      <div className="mb-6 px-2">
        <span className="text-sm font-semibold tracking-tight text-light">ElectIQ</span>
      </div>

      {sections.map((section) => (
        <div key={section.title} className="mb-5">
          <p className="mb-1.5 px-2 text-xs font-medium text-neutral">{section.title}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const Icon = item.icon;
              if (item.href) {
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-light hover:bg-white/5"
                    >
                      <Icon className="h-4 w-4 text-accent" />
                      {item.label}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={item.label}>
                  <span
                    aria-disabled="true"
                    title={`Planned for Sprint ${item.sprint}`}
                    className="flex cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-sm text-neutral/60"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px]">
                      S{item.sprint}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
