import type {
  Alert,
  Dependency,
  NexusData,
  Priority,
  PulseItem,
  ResourceItem,
  Session,
  Task,
  Volunteer,
  VolunteerLoad,
} from "@/types";
import { NOW } from "@/data/seed";
import { isOverdue, isToday } from "./format";

const SEV_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/* ------------------------------- KPIs --------------------------------- */

export interface Kpis {
  participants: number;
  activeVolunteers: number;
  tasksTotal: number;
  tasksCompleted: number;
  atRiskItems: number;
  upcomingSessions: number;
  resourceUtilization: number;
}

export function computeKpis(data: NexusData): Kpis {
  const tasksTotal = data.tasks.length;
  const tasksCompleted = data.tasks.filter((t) => t.status === "completed").length;
  const atRiskItems =
    data.alerts.filter((a) => !a.acknowledged && a.severity !== "info").length +
    data.tasks.filter((t) => t.status === "blocked").length +
    data.sessions.filter((s) => s.riskLevel === "critical").length;

  const upcomingSessions = data.sessions.filter(
    (s) => new Date(s.endsAt).getTime() >= new Date(NOW).getTime(),
  ).length;

  const totalResourceUnits = data.resources.reduce((n, r) => n + r.quantity, 0);
  const assignedUnits = data.resources.reduce((n, r) => n + r.assigned, 0);
  const resourceUtilization = totalResourceUnits === 0 ? 0 : (assignedUnits / totalResourceUnits) * 100;

  return {
    participants: data.event.participantTarget,
    activeVolunteers: data.event.volunteerPool,
    tasksTotal,
    tasksCompleted,
    atRiskItems,
    upcomingSessions: data.event.programmeItems || upcomingSessions,
    resourceUtilization,
  };
}

/* ---------------------------- event health ---------------------------- */

export function eventHealthScore(data: NexusData): number {
  const avg = data.healthMetrics.reduce((n, m) => n + m.score, 0) / (data.healthMetrics.length || 1);
  return Math.round(avg);
}

export function healthLabel(score: number): "healthy" | "warning" | "critical" {
  if (score >= 88) return "healthy";
  if (score >= 75) return "warning";
  return "critical";
}

/* ------------------------------- pulse -------------------------------- */

export function operationalPulse(data: NexusData): PulseItem[] {
  const venueStatus = (id: string) => data.venues.find((v) => v.id === id)?.status ?? "healthy";
  const sessionOf = (id: string) => data.sessions.find((s) => s.id === id);

  const av = data.tasks.find((t) => t.id === "t02");
  const coverageGaps = data.alerts.find((a) => a.id === "a1");

  const items: PulseItem[] = [
    {
      id: "p-reg",
      label: "Registration",
      detail: `${data.volunteers.filter((v) => v.teamId === "t-reg" && v.status === "assigned").length} staff on desk · flow steady`,
      health: "healthy",
      entity: { kind: "venue", id: "v-lobby", label: "Registration Lobby" },
      metric: "98% cleared",
    },
    {
      id: "p-main",
      label: "Main Stage",
      detail: sessionOf("s-hack")?.title ?? "Hackathon Final Pitch",
      health: venueStatus("v-main") === "healthy" ? "healthy" : "warning",
      entity: { kind: "venue", id: "v-main", label: "Main Auditorium" },
      metric: "On schedule",
    },
    {
      id: "p-av",
      label: "AV Setup",
      detail: av ? `${av.title} · ${av.progress}% complete` : "AV line check in progress",
      health: "warning",
      entity: { kind: "task", id: "t02", label: "Confirm Main Stage AV line check" },
      metric: "18 min delay",
    },
    {
      id: "p-vol",
      label: "Volunteer Coverage",
      detail: coverageGaps?.description ?? "Roster complete",
      health: "critical",
      entity: { kind: "session", id: "s-hack", label: "Hackathon Final Pitch" },
      metric: "2 gaps",
    },
    {
      id: "p-spk",
      label: "Speaker Coordination",
      detail: `${data.speakers.filter((s) => s.arrivalStatus === "confirmed").length}/${data.speakers.length} arrivals confirmed`,
      health: "healthy",
      entity: { kind: "speaker", id: "sp2", label: "Rohan Verma" },
      metric: "6/8 arrived",
    },
    {
      id: "p-robot",
      label: "Robotics Arena",
      detail: "Safety sweep + generator test outstanding",
      health: "critical",
      entity: { kind: "venue", id: "v-robot", label: "Robotics Arena" },
      metric: "Delayed",
    },
  ];
  return items;
}

/* -------------------------------- alerts ------------------------------ */

export function activeAlerts(data: NexusData): Alert[] {
  return [...data.alerts].sort((a, b) => {
    const rank = { critical: 0, warning: 1, info: 2 };
    return rank[a.severity] - rank[b.severity] || (a.timestamp < b.timestamp ? 1 : -1);
  });
}

export function alertsBySeverity(data: NexusData, sev: Alert["severity"]): Alert[] {
  return activeAlerts(data).filter((a) => a.severity === sev);
}

/* -------------------------------- tasks ------------------------------- */

export type TaskView = "all" | "mine" | "critical" | "overdue" | "today" | "completed";

export function filterTasks(tasks: Task[], view: TaskView, currentUserId: string): Task[] {
  switch (view) {
    case "mine":
      return tasks.filter((t) => t.ownerId === currentUserId);
    case "critical":
      return tasks.filter((t) => t.priority === "critical" && t.status !== "completed");
    case "overdue":
      return tasks.filter((t) => isOverdue(t.deadline, NOW) && t.status !== "completed");
    case "today":
      return tasks.filter((t) => isToday(t.deadline, NOW));
    case "completed":
      return tasks.filter((t) => t.status === "completed");
    default:
      return tasks;
  }
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) => SEV_RANK[b.priority] - SEV_RANK[a.priority] || (a.deadline < b.deadline ? -1 : 1),
  );
}

export function blockedDependents(tasks: Task[], task: Task): Task[] {
  return tasks.filter((t) => t.dependencyIds.includes(task.id));
}

/* ------------------------------ volunteers ---------------------------- */

export function loadBand(workload: number): VolunteerLoad {
  if (workload < 50) return "underloaded";
  if (workload <= 80) return "balanced";
  return "overloaded";
}

export function volunteerLoadSummary(volunteers: Volunteer[]) {
  return {
    underloaded: volunteers.filter((v) => loadBand(v.workload) === "underloaded").length,
    balanced: volunteers.filter((v) => loadBand(v.workload) === "balanced").length,
    overloaded: volunteers.filter((v) => loadBand(v.workload) === "overloaded").length,
  };
}

export function overloadedVolunteers(volunteers: Volunteer[]): Volunteer[] {
  return volunteers.filter((v) => loadBand(v.workload) === "overloaded").sort((a, b) => b.workload - a.workload);
}

/* ------------------------------- resources ---------------------------- */

export function resourceConflicts(resources: ResourceItem[]): ResourceItem[] {
  return resources.filter((r) => r.assigned > r.available);
}

export function resourceUtilization(resources: ResourceItem[]): number {
  const total = resources.reduce((n, r) => n + r.quantity, 0);
  const assigned = resources.reduce((n, r) => n + r.assigned, 0);
  return total === 0 ? 0 : (assigned / total) * 100;
}

/* -------------------------------- teams ------------------------------- */

export interface TeamRollup {
  teamId: string;
  name: string;
  status: NexusData["teams"][number]["status"];
  leadName: string;
  volunteers: number;
  openTasks: number;
  doneTasks: number;
}

export function teamRollups(data: NexusData): TeamRollup[] {
  return data.teams.map((team) => {
    const members = data.members.filter((m) => m.teamId === team.id);
    const lead = members.find((m) => m.id === team.leadMemberId);
    const teamTasks = data.tasks.filter((t) => t.teamId === team.id);
    return {
      teamId: team.id,
      name: team.name,
      status: team.status,
      leadName: lead?.name ?? "Unassigned",
      volunteers: data.volunteers.filter((v) => v.teamId === team.id).length,
      openTasks: teamTasks.filter((t) => t.status !== "completed").length,
      doneTasks: teamTasks.filter((t) => t.status === "completed").length,
    };
  });
}

/* ------------------------------- helpers ------------------------------ */

export function findSession(data: NexusData, id: string): Session | undefined {
  return data.sessions.find((s) => s.id === id);
}

export function entityLabel(data: NexusData, kind: string, id: string): string {
  switch (kind) {
    case "venue": return data.venues.find((v) => v.id === id)?.name ?? id;
    case "session": return data.sessions.find((s) => s.id === id)?.title ?? id;
    case "speaker": return data.speakers.find((s) => s.id === id)?.name ?? id;
    case "team": return data.teams.find((t) => t.id === id)?.name ?? id;
    case "member": return data.members.find((m) => m.id === id)?.name ?? id;
    case "volunteer": return data.volunteers.find((v) => v.id === id)?.name ?? id;
    case "task": return data.tasks.find((t) => t.id === id)?.title ?? id;
    case "resource": return data.resources.find((r) => r.id === id)?.name ?? id;
    case "communication": return data.communications.find((c) => c.id === id)?.subject ?? id;
    default: return id;
  }
}

export function dependenciesTouching(data: NexusData, kind: string, id: string): Dependency[] {
  return data.dependencies.filter(
    (dep) => (dep.source.kind === kind && dep.source.id === id) || (dep.target.kind === kind && dep.target.id === id),
  );
}
