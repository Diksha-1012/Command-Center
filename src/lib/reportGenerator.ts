import type { EventReport, MemoryEntry, NexusData, ReportSection, Severity } from "@/types";
import { CURRENT_USER_ID, NOW } from "@/data/seed";
import { computeKpis, overloadedVolunteers, resourceConflicts } from "./selectors";
import { analyzeRisk } from "./riskEngine";
import { dailyBrief } from "./brief";
import { buildReplay } from "./replay";

/**
 * NEXUS POST-EVENT REPORT (Part 3)
 * ======================================================================
 * Generates a retrospective from VERIFIED event records. Narrative sections are
 * explicitly labelled AI GENERATED and list the records they were derived from;
 * deterministic sections are VERIFIED.
 */

function sevCount(data: NexusData): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, warning: 0, info: 0 };
  for (const i of data.incidents) counts[i.severity] += 1;
  return counts;
}

export function generateEventReport(data: NexusData, memories: MemoryEntry[]): EventReport {
  const kpis = computeKpis(data);
  const risk = analyzeRisk(data);
  const incidents = sevCount(data);
  const replay = buildReplay(data);
  const openIncidents = data.incidents.filter((i) => i.status !== "resolved");
  const conflicts = resourceConflicts(data.resources);
  const overloaded = overloadedVolunteers(data.volunteers);
  const completion = Math.round((kpis.tasksCompleted / (kpis.tasksTotal || 1)) * 100);
  const brief = dailyBrief(data);

  const sections: ReportSection[] = [
    {
      id: "summary",
      title: "Event summary",
      kind: "generated",
      body:
        `${data.event.name} ran on ${data.event.date} at ${data.venues.find((v) => v.id === data.event.venueId)?.name ?? "the main venue"}. ` +
        `NEXUS tracked ${data.sessions.length} sessions, ${data.tasks.length} tasks, ${data.volunteers.length} rostered volunteers and ${data.dependencies.length} declared dependencies.`,
      bullets: [
        data.event.tagline,
        `Organised by ${data.event.organizers.join(", ")}.`,
        `${replay.length} operational events reconstructed on the replay timeline.`,
      ],
      sources: [{ kind: "event", id: data.event.id, label: data.event.name }],
    },
    {
      id: "attendance",
      title: "Attendance",
      kind: "verified",
      body: `${data.event.participantTarget.toLocaleString()} attendees registered against a ${data.event.volunteerPool}-strong volunteer pool.`,
      bullets: data.sessions.slice(0, 6).map((s) => `${s.title}: ${s.expectedAttendance.toLocaleString()} expected`),
      sources: data.sessions.slice(0, 4).map((s) => ({ kind: "session" as const, id: s.id, label: s.title })),
    },
    {
      id: "tasks",
      title: "Task completion",
      kind: "verified",
      body: `${kpis.tasksCompleted} of ${kpis.tasksTotal} tasks completed (${completion}%).`,
      bullets: [
        `${data.tasks.filter((t) => t.status === "blocked").length} tasks remained blocked at close.`,
        `${data.tasks.filter((t) => t.status !== "completed" && new Date(t.deadline).getTime() < new Date(NOW).getTime()).length} tasks closed past deadline.`,
      ],
      sources: data.tasks.slice(0, 4).map((t) => ({ kind: "task" as const, id: t.id, label: t.title })),
    },
    {
      id: "incidents",
      title: "Critical incidents",
      kind: "verified",
      body: `${data.incidents.length} incidents logged — ${incidents.critical} critical, ${incidents.warning} warning, ${incidents.info} informational.`,
      bullets: openIncidents.slice(0, 5).map((i) => `${i.severity.toUpperCase()}: ${i.title} (${i.status})`),
      sources: openIncidents.slice(0, 4).map((i) => ({ kind: "incident" as const, id: i.id, label: i.title })),
    },
    {
      id: "volunteers",
      title: "Volunteer performance",
      kind: "generated",
      body: `${data.volunteers.length} volunteers accounted for; ${overloaded.length} finished above the 90% workload threshold.`,
      bullets: [
        overloaded.length
          ? `Overloaded: ${overloaded.slice(0, 5).map((v) => `${v.name} (${v.workload}%)`).join(", ")}.`
          : "No volunteer exceeded the workload threshold.",
        `${data.volunteers.filter((v) => v.status === "standby").length} volunteers remained on standby at close.`,
      ],
      sources: overloaded.slice(0, 4).map((v) => ({ kind: "volunteer" as const, id: v.id, label: v.name })),
    },
    {
      id: "resources",
      title: "Resource usage",
      kind: "verified",
      body: `${Math.round(kpis.resourceUtilization)}% overall equipment utilisation across ${data.resources.length} resource lines.`,
      bullets: conflicts.length
        ? conflicts.map((r) => `${r.name}: over-allocated (${r.assigned}/${r.available}).`)
        : ["No resource over-allocation detected at close."],
      sources: conflicts.slice(0, 4).map((r) => ({ kind: "resource" as const, id: r.id, label: r.name })),
    },
    {
      id: "impact",
      title: "Major changes & impact events",
      kind: "verified",
      body: `${risk.findings.length} risk conditions and ${replay.filter((e) => e.kind === "simulation" || e.kind === "approval").length} change/impact events were recorded.`,
      bullets: replay
        .filter((e) => ["request", "simulation", "approval", "ai"].includes(e.kind))
        .slice(0, 6)
        .map((e) => `${e.at} · ${e.title}`),
      sources: risk.findings.slice(0, 4).flatMap((f) => (f.ref ? [f.ref] : [])),
    },
    {
      id: "lessons",
      title: "Lessons learned",
      kind: "verified",
      body: `${memories.length} reusable memories were captured from this event.`,
      bullets: memories.slice(0, 6).map((m) => `${m.title} — source: ${m.source}`),
      sources: memories.slice(0, 4).flatMap((m) => m.related.slice(0, 1)),
    },
    {
      id: "recommendations",
      title: "Recommendations",
      kind: "generated",
      body: "Projected improvements for the next run, produced by the NEXUS recommendation engine over the verified records above.",
      bullets: brief.actions.map((a) => `${a.title} — ${a.detail}`),
      sources: brief.actions.flatMap((a) => a.related).slice(0, 5),
    },
  ];

  return {
    id: `report-${data.event.id}`,
    eventId: data.event.id,
    title: `${data.event.name} — Event Report`,
    generatedAt: new Date().toISOString(),
    summary:
      `${kpis.tasksCompleted}/${kpis.tasksTotal} tasks complete, ${data.incidents.length} incidents (${incidents.critical} critical), ` +
      `${overloaded.length} volunteers over threshold, ${Math.round(kpis.resourceUtilization)}% resource utilisation.`,
    sections,
    metrics: [
      { label: "Attendance", value: data.event.participantTarget.toLocaleString(), tone: "blue" },
      { label: "Task completion", value: `${completion}%`, tone: completion >= 80 ? "ok" : "warn" },
      { label: "Critical incidents", value: String(incidents.critical), tone: incidents.critical ? "bad" : "ok" },
      { label: "Volunteers", value: String(data.volunteers.length), tone: "neutral" },
      { label: "Resource use", value: `${Math.round(kpis.resourceUtilization)}%`, tone: "warn" },
      { label: "Memories captured", value: String(memories.length), tone: "ai" },
    ],
    recommendations: brief.actions,
  };
}

export function reportOwner(data: NexusData): string {
  return data.members.find((m) => m.id === CURRENT_USER_ID)?.name ?? "Operations Lead";
}
