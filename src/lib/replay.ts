import type { NexusData, ReplayEvent } from "@/types";

/**
 * NEXUS EVENT REPLAY (Part 3)
 * ======================================================================
 * A single chronological story of the event: the human decisions, the AI
 * detections, the impact simulations and the approvals — merged from the
 * seeded narrative and the live activity/incident records so the replay grows
 * as the event runs.
 */

const D = "2026-11-15T";

function at(hhmm: string): { at: string; sortKey: string } {
  return { at: hhmm, sortKey: `${D}${hhmm}` };
}

/** The core storyline the pitch walks through. */
function scripted(data: NexusData): ReplayEvent[] {
  const hack = data.sessions.find((s) => s.id === "s-hack");
  const speaker = data.speakers.find((s) => s.id === "sp4");
  const volunteer = data.volunteers.find((v) => v.id === "v13");
  const venue = data.venues.find((v) => v.id === "v-main");
  const alt = data.venues.find((v) => v.id === "v-innov");

  return [
    {
      id: "rp-1",
      ...at("09:00"),
      kind: "start",
      title: "Event started",
      detail: `${data.event.name} opened — ${data.sessions.find((s) => s.id === "s-open")?.expectedAttendance.toLocaleString() ?? "1,100"} attendees in ${venue?.name ?? "Main Auditorium"}.`,
      actor: "Operations",
      severity: "info",
    },
    {
      id: "rp-2",
      ...at("10:15"),
      kind: "delay",
      title: "Speaker delayed",
      detail: `${speaker?.name ?? "Robotics speaker"} held up in traffic; arrival pushed by ~25 minutes.`,
      actor: "Hospitality",
      severity: "warning",
      related: speaker ? [{ kind: "speaker", id: speaker.id, label: speaker.name }] : [],
    },
    {
      id: "rp-3",
      ...at("10:18"),
      kind: "ai",
      title: "AI risk detected",
      detail: "NEXUS correlated the delay with the dependency graph and flagged the affected programme block before it started.",
      actor: "NEXUS Risk Engine",
      severity: "warning",
    },
    {
      id: "rp-4",
      ...at("10:20"),
      kind: "reassign",
      title: "Volunteer reassigned",
      detail: `${volunteer?.name ?? "A volunteer"} repositioned to close the entry-control gap; standby pool notified.`,
      actor: "Operations Lead",
      severity: "info",
      related: volunteer ? [{ kind: "volunteer", id: volunteer.id, label: volunteer.name }] : [],
    },
    {
      id: "rp-5",
      ...at("12:40"),
      kind: "request",
      title: "Venue change requested",
      detail: `${venue?.name ?? "Main Auditorium"} flagged unavailable; operations requested a relocation to ${alt?.name ?? "Innovation Hall"}.`,
      actor: "Facilities",
      severity: "critical",
      related: venue ? [{ kind: "venue", id: venue.id, label: venue.name }] : [],
    },
    {
      id: "rp-6",
      ...at("12:41"),
      kind: "simulation",
      title: "Impact simulation",
      detail: `Blast radius computed for "${hack?.title ?? "Hackathon Final Pitch"}" — sessions, speakers, resources, volunteers, tasks and communications evaluated.`,
      actor: "NEXUS Impact Engine",
      severity: "warning",
      related: hack ? [{ kind: "session", id: hack.id, label: hack.title }] : [],
      link: "/impact",
    },
    {
      id: "rp-7",
      ...at("12:43"),
      kind: "approval",
      title: "Change approved",
      detail: "Operations lead reviewed the plan and approved the relocation; affected records written back to Notion.",
      actor: "Aisha Khan",
      severity: "info",
      link: "/command",
    },
  ];
}

function kindForActivity(kind: string): ReplayEvent["kind"] {
  switch (kind) {
    case "incident":
      return "incident";
    case "alert":
      return "ai";
    case "detection":
      return "ai";
    case "recommendation":
      return "simulation";
    case "approval":
      return "approval";
    case "sync":
      return "sync";
    case "change":
      return "request";
    default:
      return "reassign";
  }
}

export function buildReplay(data: NexusData): ReplayEvent[] {
  const derived: ReplayEvent[] = data.activity.map((a) => ({
    id: `rp-${a.id}`,
    at: a.at.slice(11, 16),
    sortKey: a.at,
    kind: kindForActivity(a.kind),
    title: a.title,
    detail: a.detail ?? "",
    actor: a.actor,
    severity: a.kind === "incident" ? "warning" : a.kind === "alert" ? "info" : "info",
    related: a.related,
  }));

  for (const inc of data.incidents) {
    derived.push({
      id: `rp-${inc.id}`,
      at: inc.timestamp.slice(11, 16),
      sortKey: inc.timestamp,
      kind: inc.status === "resolved" || inc.status === "mitigated" ? "resolve" : "incident",
      title: `${inc.status === "resolved" || inc.status === "mitigated" ? "Resolved" : "Incident"}: ${inc.title}`,
      detail: inc.notes,
      actor: data.members.find((m) => m.id === inc.ownerId)?.name ?? inc.reportedBy,
      severity: inc.severity,
      related: inc.relatedSessionId
        ? [{ kind: "session", id: inc.relatedSessionId, label: data.sessions.find((s) => s.id === inc.relatedSessionId)?.title ?? inc.relatedSessionId }]
        : [],
      link: "/incidents",
    });
  }

  const seen = new Set<string>();
  const merged = [...scripted(data), ...derived]
    .filter((e) => (seen.has(e.title) ? false : (seen.add(e.title), true)))
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : 1));

  return merged;
}