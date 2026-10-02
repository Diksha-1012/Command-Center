import type { Priority, Severity, TaskStatus } from "@/types";

export function timeOf(iso: string): string {
  const day = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return iso;
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  void day;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function dateLabel(iso: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const y = iso.slice(0, 4);
  const mo = Number(iso.slice(5, 7));
  const da = iso.slice(8, 10);
  return `${da} ${months[mo - 1]} ${y}`;
}

export function relativeFromNow(iso: string, nowIso: string): string {
  const diff = (new Date(iso).getTime() - new Date(nowIso).getTime()) / 60000;
  const abs = Math.abs(diff);
  const past = diff < 0;
  let label: string;
  if (abs < 1) label = "just now";
  else if (abs < 60) label = `${Math.round(abs)}m`;
  else if (abs < 60 * 24) label = `${Math.round(abs / 60)}h ${Math.round(abs % 60)}m`;
  else label = `${Math.round(abs / (60 * 24))}d`;
  if (label === "just now") return label;
  return past ? `${label} ago` : `in ${label}`;
}

export function isOverdue(deadlineIso: string, nowIso: string): boolean {
  return new Date(deadlineIso).getTime() < new Date(nowIso).getTime();
}

export function isToday(iso: string, nowIso: string): boolean {
  return iso.slice(0, 10) === nowIso.slice(0, 10);
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
