import {
  Activity,
  BookMarked,
  Bot,
  BrainCircuit,
  CalendarDays,
  Database,
  FileText,
  History,
  LayoutDashboard,
  ListChecks,
  Package,
  Plug,
  QrCode,
  Settings as SettingsIcon,
  ShieldCheck,
  Siren,
  Smartphone,
  Sparkles,
  Ticket,
  Users,
  UserSquare2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: "Main" | "Operations" | "Intelligence" | "Knowledge" | "System";
  badgeKey?: "alerts" | "tasks" | "incidents";
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, group: "Main" },
  { to: "/events", label: "Events", icon: Ticket, group: "Main" },
  { to: "/command", label: "Command Center", icon: Activity, group: "Main", badgeKey: "alerts" },
  { to: "/schedule", label: "Schedule", icon: CalendarDays, group: "Operations" },
  { to: "/teams", label: "Teams", icon: Users, group: "Operations" },
  { to: "/volunteers", label: "Volunteers", icon: UserSquare2, group: "Operations" },
  { to: "/tasks", label: "Tasks", icon: ListChecks, group: "Operations", badgeKey: "tasks" },
  { to: "/resources", label: "Resources", icon: Package, group: "Operations" },
  { to: "/incidents", label: "Incidents", icon: Siren, group: "Operations", badgeKey: "incidents" },
  { to: "/timeline", label: "Timeline", icon: History, group: "Operations" },
  { to: "/replay", label: "Event Replay", icon: ShieldCheck, group: "Operations" },
  { to: "/impact", label: "Impact Simulator", icon: BrainCircuit, group: "Intelligence" },
  { to: "/reports", label: "Event Report", icon: FileText, group: "Intelligence" },
  { to: "/knowledge", label: "Knowledge & Memory", icon: Sparkles, group: "Intelligence" },
  { to: "/copilot", label: "AI Copilot", icon: Bot, group: "Intelligence" },
  { to: "/notion", label: "Notion Wizard", icon: Plug, group: "Knowledge" },
  { to: "/sync", label: "Notion Sync Center", icon: Database, group: "Knowledge" },
  { to: "/me", label: "Volunteer View", icon: Smartphone, group: "System" },
  { to: "/join", label: "QR Join", icon: QrCode, group: "System" },
  { to: "/docs", label: "Architecture", icon: BookMarked, group: "System" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, group: "System" },
];

export const NAV_GROUPS: NavItem["group"][] = ["Main", "Operations", "Intelligence", "Knowledge", "System"];

