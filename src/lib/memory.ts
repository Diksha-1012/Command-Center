import type { MemoryEntry, MemoryKind, NexusData } from "@/types";
import { NOW } from "@/data/seed";

/**
 * NEXUS MEMORY (Part 3)
 * ======================================================================
 * After an event, NEXUS converts what happened into reusable knowledge:
 * lessons learned, incidents, decisions, successful/failed workflows and
 * operational notes. Memories link back to the records they came from and are
 * written into the NEXUS Knowledge database on the next Notion sync.
 */

export const MEMORY_KIND_META: Record<MemoryKind, { label: string; tone: "ok" | "warn" | "bad" | "ai" | "blue" | "neutral" }> = {
  lesson: { label: "Lesson", tone: "warn" },
  incident: { label: "Incident", tone: "bad" },
  decision: { label: "Decision", tone: "blue" },
  workflow_success: { label: "Successful workflow", tone: "ok" },
  workflow_failure: { label: "Failed workflow", tone: "bad" },
  note: { label: "Operational note", tone: "neutral" },
};

/** Curated, reusable memories captured from the event retrospective. */
export function seedMemory(data: NexusData): MemoryEntry[] {
  const mainStage = data.venues.find((v) => v.id === "v-main");
  const robot = data.sessions.find((s) => s.id === "s-robot");
  const hack = data.sessions.find((s) => s.id === "s-hack");
  const workshop = data.sessions.find((s) => s.id === "s-dev");
  const lobby = data.venues.find((v) => v.id === "v-lobby");

  return [
    {
      id: "mem-av-lead",
      kind: "lesson",
      title: "Main stage AV check should begin 45 minutes before opening",
      body:
        "Every session that depends on the main stage AV chain lost time when the line check started late. Starting 45 minutes before doors removes the critical-path delay without extra volunteer cover.",
      source: "Post-event report",
      tags: ["AV", "main stage", "timing"],
      related: [{ kind: "venue", id: "v-main", label: mainStage?.name ?? "Main Auditorium" }],
      reusable: true,
      capturedAt: NOW,
      notionPageId: "ntn-3",
    },
    {
      id: "mem-arena-sweep",
      kind: "decision",
      title: "Robotics arena safety sweep must complete before generator tests",
      body:
        `The safety sweep gated "${robot?.title ?? "Robotics Arena"}". Escalating the sweep owner before the opening block prevented a cascading rig delay.`,
      source: "Operations decision log",
      tags: ["robotics", "safety", "dependency"],
      related: robot ? [{ kind: "session", id: robot.id, label: robot.title }] : [],
      reusable: true,
      capturedAt: NOW,
    },
    {
      id: "mem-entry-lanes",
      kind: "workflow_success",
      title: "Two-lane entry control cleared the Main Stage backlog in 8 minutes",
      body:
        `When "${hack?.title ?? "Hackathon Final Pitch"}" became under-staffed at the gate, opening a second lane and pulling standby volunteers cleared the queue before the keynote.`,
      source: "Post-event report",
      tags: ["crowd", "volunteers", "incident response"],
      related: hack ? [{ kind: "session", id: hack.id, label: hack.title }] : [],
      reusable: true,
      capturedAt: NOW,
    },
    {
      id: "mem-badge-saturation",
      kind: "workflow_failure",
      title: "Badge printers saturate when more than three late-registration waves overlap",
      body:
        `At the ${lobby?.name ?? "Registration Lobby"}, all four badge printers saturated and a manual fallback had to be enabled. Staggering late-registration waves keeps at least one printer free.`,
      source: "Incident log",
      tags: ["registration", "capacity"],
      related: [{ kind: "resource", id: "r7", label: "Badge Printers" }],
      reusable: true,
      capturedAt: NOW,
    },
    {
      id: "mem-workshop-mic",
      kind: "lesson",
      title: "Keep a spare podium mic in the AV store during workshop tracks",
      body:
        `"${workshop?.title ?? "Developer Workshop"}" was ~18 minutes behind its line check; a spare mic from the AV store recovered the schedule.`,
      source: "Post-event report",
      tags: ["workshop", "AV"],
      related: workshop ? [{ kind: "session", id: workshop.id, label: workshop.title }] : [],
      reusable: true,
      capturedAt: NOW,
    },
    {
      id: "mem-shuttle-buffer",
      kind: "note",
      title: "Speaker shuttle needs a ~25 minute buffer at Gate 1 during peak",
      body:
        "A delayed speaker arrival forced a programme reorder. Building a 25 minute buffer into shuttle pickups absorbs traffic peaks.",
      source: "Operations note",
      tags: ["hospitality", "logistics", "speakers"],
      related: [{ kind: "speaker", id: "sp4", label: "Vikram Rao" }],
      reusable: true,
      capturedAt: NOW,
    },
  ];
}

/** Memories derived from the live event so knowledge grows as things happen. */
export function deriveMemories(data: NexusData): MemoryEntry[] {
  const out: MemoryEntry[] = [];
  for (const incident of data.incidents) {
    if (incident.status === "resolved" || incident.status === "mitigated") {
      out.push({
        id: `mem-${incident.id}`,
        kind: "incident",
        title: incident.title,
        body: incident.notes,
        source: "Incident log",
        tags: [incident.severity, incident.location],
        related: [
          { kind: "incident", id: incident.id, label: incident.title },
          ...(incident.relatedSessionId
            ? [{
                kind: "session" as const,
                id: incident.relatedSessionId,
                label: data.sessions.find((s) => s.id === incident.relatedSessionId)?.title ?? incident.relatedSessionId,
              }]
            : []),
        ],
        reusable: incident.severity === "critical",
        capturedAt: incident.timestamp,
      });
    }
  }
  return out;
}

export function allMemories(data: NexusData, extra: MemoryEntry[]): MemoryEntry[] {
  const derived = deriveMemories(data);
  const seen = new Set<string>();
  return [...extra, ...derived].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

export function memoryByKind(memories: MemoryEntry[]) {
  const counts: Record<string, number> = {};
  for (const m of memories) counts[m.kind] = (counts[m.kind] ?? 0) + 1;
  return counts;
}