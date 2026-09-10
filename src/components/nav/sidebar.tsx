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
    items: [{ label: "Command Center", href: "/command-center", icon: LayoutDashboard }],
  },
  {
    title: "Election",
    items: [
      { label: "Elections", href: "/command-center/elections", icon: Vote },
      { label: "Candidates", href: "/command-center/elections", icon: Users2 },
      { label: "Parties", href: "/command-center/elections", icon: Flag },
      { label: "Polling Stations", href: "/command-center/polling-stations", icon: MapPin },
      { label: "Results", href: "/command-center/results", icon: BarChart3 },
      { label: "Turnout", icon: Radar, sprint: 4 },
      { label: "Election Map", href: "/command-center/election-map", icon: Globe },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Incidents", icon: ShieldAlert, sprint: 6 },
      { label: "Observers", icon: Eye, sprint: 6 },
      { label: "Field Reports", icon: ClipboardList, sprint: 6 },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Analytics", icon: BarChart3, sprint: 8 },
      { label: "ElectIQ Copilot", icon: Sparkles, sprint: 7 },
      { label: "Integrity Alerts", icon: ShieldAlert, sprint: 5 },
      { label: "Historical Analytics", icon: History, sprint: 8 },
      { label: "Scenario Lab", icon: FlaskConical, sprint: 9 },
    ],
  },
  {
    title: "Assurance",
    items: [
      { label: "Evidence Vault", href: "/command-center/results", icon: Vault },
      { label: "Verification", href: "/command-center/results", icon: CheckSquare },
      { label: "Audit Logs", icon: ScrollText, sprint: 11 },
    ],
  },
  {
    title: "Reporting",
    items: [{ label: "Reports", icon: FileText, sprint: 8 }],
  },
  {
    title: "Publication",
    items: [
      { label: "Public Portal", icon: Globe, sprint: 10 },
      { label: "API Management", icon: Plug, sprint: 10 },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Users", icon: UserCog, sprint: 11 },
      { label: "Roles", icon: KeyRound, sprint: 11 },
      { label: "Permissions", icon: KeyRound, sprint: 11 },
      { label: "System Settings", icon: Settings, sprint: 11 },
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
