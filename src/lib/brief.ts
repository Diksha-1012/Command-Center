import type { EntityRef, NexusData, RecommendedAction, Severity } from "@/types";
import { CURRENT_USER_ID, NOW } from "@/data/seed";
import { activeAlerts, computeKpis, overloadedVolunteers, resourceConflicts } from "./selectors";
import { analyzeRisk } from "./riskEngine";
import { teamLoadMap } from "./workloadAnalyzer";

/**
 * NEXUS DAILY BRIEF (Part 2)
 * ======================================================================
 * A deterministic "what happened / what matters" digest. Every line links
 * to the underlying record so the organizer can jump straight to it.
 */

export interface BriefItem {
  id: string;
  level: Severity;
  text: string;
  ref?: EntityRef;
  /** VERIFIED = a fact read from records. insight = an AI interpretation. */
  kind: "verified" | "insight";
  /** For insights: the reasoning behind the interpretation. */
  why?: string;
}

export interface DailyBrief {
  greeting: string;
  items: BriefItem[];
  actions: RecommendedAction[];
  health: { label: string; value: string; tone: Severity }[];
}

export function dailyBrief(data: NexusData): DailyBrief {
  const me = data.members.find((m) => m.id === CURRENT_USER_ID);
  const kpis = computeKpis(data);
  const alerts = activeAlerts(data).filter((a) => !a.acknowledged);
  const risk = analyzeRisk(data);
  const loads = teamLoadMap(data);
  const conflicts = resourceConflicts(data.resources);
  const overloaded = overloadedVolunteers(data.volunteers);

  const items: BriefItem[] = [];

  /* -------------------------- VERIFIED FACTS ------------------------- */

  for (const a of alerts.filter((x) => x.severity === "critical")) {
    items.push({ id: `a-${a.id}`, level: "critical", text: a.title, ref: a.related, kind: "verified" });
  }

  const overdue = data.tasks.filter((t) => t.status !== "completed" && new Date(t.deadline).getTime() < new Date(NOW).getTime());
  if (overdue.length) {
    items.push({
      id: "overdue",
      level: "warning",
      text: `${overdue.length} task${overdue.length === 1 ? "" : "s"} past deadline, including "${overdue[0].title}".`,
      ref: { kind: "task", id: overdue[0].id, label: overdue[0].title },
      kind: "verified",
    });
  }

  if (conflicts.length) {
    items.push({
      id: "conflicts",
      level: "warning",
      text: `${conflicts.length} equipment conflict${conflicts.length === 1 ? "" : "s"} — ${conflicts[0].name} is short by ${conflicts[0].assigned - conflicts[0].available} units.`,
      ref: { kind: "resource", id: conflicts[0].id, label: conflicts[0].name },
      kind: "verified",
    });
  }

  if (overloaded.length) {
    items.push({
      id: "overloaded",
      level: "warning",
      text: `${overloaded.length} volunteer${overloaded.length === 1 ? "" : "s"} above 90% workload — ${overloaded[0].name} at ${overloaded[0].workload}%.`,
      ref: { kind: "volunteer", id: overloaded[0].id, label: overloaded[0].name },
      kind: "verified",
    });
  }

  const blocked = data.tasks.filter((t) => t.status === "blocked");
  if (blocked.length) {
    items.push({
      id: "blocked",
      level: "warning",
      text: `${blocked.length} task${blocked.length === 1 ? "" : "s"} blocked, including "${blocked[0].title}".`,
      ref: { kind: "task", id: blocked[0].id, label: blocked[0].title },
      kind: "verified",
    });
  }

  /* ---------------------------- AI INSIGHTS -------------------------- */

  // Insight: overdue tasks that converge on a single session create a bottleneck.
  if (overdue.length) {
    const sessionCounts = new Map<string, number>();
    for (const t of overdue) if (t.sessionId) sessionCounts.set(t.sessionId, (sessionCounts.get(t.sessionId) ?? 0) + 1);
    const bottleneck = [...sessionCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (bottleneck) {
      const session = data.sessions.find((s) => s.id === bottleneck[0]);
      items.push({
        id: "insight-bottleneck",
        level: "critical",
        text: `The ${bottleneck[1]} overdue task${bottleneck[1] === 1 ? "" : "s"} converge on ${session?.title ?? bottleneck[0]}, creating a dependency bottleneck.`,
        ref: session ? { kind: "session", id: session.id, label: session.title } : undefined,
        kind: "insight",
        why: `${bottleneck[1]} of the overdue tasks are linked to the same session; clearing them together unblocks that session's critical path.`,
      });
    } else {
      items.push({
        id: "insight-overdue",
        level: "warning",
        text: `Overdue work is spread across departments rather than one bottleneck — prioritise the highest-priority item first.`,
        kind: "insight",
        why: "No single session or team concentrates the overdue tasks, so the risk is diffuse.",
      });
    }
  }

  const topLoad = loads.find((l) => l.overloaded);
  if (topLoad) {
    items.push({
      id: "insight-load",
      level: "warning",
      text: `${topLoad.name} department is at ${topLoad.load}% load and is the most likely source of cascading delay.`,
      ref: { kind: "team", id: topLoad.teamId, label: topLoad.name },
      kind: "insight",
      why: topLoad.drivers.join("; ") + ".",
    });
  }

  const criticalFindings = risk.findings.filter((f) => f.level === "critical").slice(0, 2);
  for (const f of criticalFindings) {
    items.push({ id: f.id, level: "critical", text: f.title, ref: f.ref, kind: "insight", why: f.reason });
  }

  const registration = data.teams.find((t) => t.id === "t-reg");
  if (registration) {
    items.push({
      id: "registration",
      level: "info",
      text: `Registration has ${data.volunteers.filter((v) => v.teamId === "t-reg" && v.status === "assigned").length} staff on desk.`,
      ref: { kind: "team", id: registration.id, label: registration.name },
      kind: "verified",
    });
  }

  const actions: RecommendedAction[] = [];

  const avTask = data.tasks.find((t) => t.id === "t02");
  if (avTask && avTask.status !== "completed") {
    actions.push({
      id: "brief-av",
      title: "Reassign an AV technician to Main Stage",
      detail: `"${avTask.title}" is blocked at ${avTask.progress}% and gates the Hackathon Final Pitch.`,
      priority: "critical",
      kind: "reassign",
      related: [{ kind: "task", id: avTask.id, label: avTask.title }],
    });
  }

  if (conflicts.length) {
    actions.push({
      id: "brief-res",
      title: `Resolve ${conflicts[0].name} shortfall`,
      detail: `Re-route ${conflicts[0].assigned - conflicts[0].available} units from low-utilisation venues or raise a procurement request.`,
      priority: "critical",
      kind: "procure",
      related: [{ kind: "resource", id: conflicts[0].id, label: conflicts[0].name }],
    });
  }

  if (overloaded.length) {
    actions.push({
      id: "brief-vol",
      title: `Rebalance ${overloaded.length} overloaded volunteer${overloaded.length === 1 ? "" : "s"}`,
      detail: `Pull from the underloaded pool — ${overloaded.map((v) => v.name).slice(0, 3).join(", ")} are above the 90% threshold.`,
      priority: "high",
      kind: "reassign",
      related: overloaded.slice(0, 3).map((v) => ({ kind: "volunteer" as const, id: v.id, label: v.name })),
    });
  }

  const pendingSpeaker = data.speakers.find((s) => s.arrivalStatus !== "confirmed");
  if (pendingSpeaker) {
    actions.push({
      id: "brief-speaker",
      title: `Confirm ${pendingSpeaker.name}'s arrival`,
      detail: `Arrival status is "${pendingSpeaker.arrivalStatus}". Confirm before the next session that depends on them.`,
      priority: "medium",
      kind: "notify",
      related: [{ kind: "speaker", id: pendingSpeaker.id, label: pendingSpeaker.name }],
    });
  }

  return {
    greeting: `Good morning, ${me?.name.split(" ")[0] ?? "organizer"}.`,
    items: items.slice(0, 8),
    actions: actions.slice(0, 6),
    health: [
      { label: "Tasks complete", value: `${kpis.tasksCompleted}/${kpis.tasksTotal}`, tone: "info" },
      { label: "At-risk items", value: String(kpis.atRiskItems), tone: kpis.atRiskItems > 5 ? "critical" : "warning" },
      { label: "Resource utilization", value: `${Math.round(kpis.resourceUtilization)}%`, tone: "warning" },
      { label: "Critical risks", value: String(risk.counts.critical), tone: risk.counts.critical ? "critical" : "info" },
    ],
  };
}
