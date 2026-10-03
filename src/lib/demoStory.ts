import type { RoleId } from "@/types";

/**
 * NEXUS OPS — DEMO STORY (KBC-NOTION-03 live demonstration)
 * ======================================================================
 * ONE story, ten scenes, ~3–5 minutes. Each scene names the exact action the
 * presenter takes, so the judge never has to be told what to do. The guide
 * navigates and triggers real app behaviour — it is not a slideshow.
 *
 *   Problem → Intelligence → Action → Notion → Knowledge
 */

export type DemoAction =
  | { type: "navigate"; to: string }
  | { type: "emergency" }
  | { type: "role"; role: RoleId }
  | { type: "none" };

export interface DemoScene {
  id: string;
  /** Scene number shown to the presenter (1-based). */
  index: number;
  title: string;
  headline: string;
  /** One or two sentences of narration for the presenter to read. */
  narration: string;
  /** Concrete things to point at on screen. */
  bullets?: string[];
  action: DemoAction;
  /** Label for the primary button. */
  actionLabel: string;
  /** Accent tone for the scene chip. */
  tone: "ok" | "warn" | "bad" | "ai" | "blue" | "neutral";
  /** Presenter-facing role shortcuts (scene 9). */
  roleChoices?: { role: RoleId; label: string; to: string }[];
}

export const DEMO_SCENES: DemoScene[] = [
  {
    id: "normal",
    index: 1,
    title: "Normal Operation",
    headline: "KINETEX TECHFEST 2026 · Event Health",
    narration:
      "We start with the whole event on one screen. This is live operational state — not a mock-up. Everything is connected.",
    bullets: ["Event health score + department metrics", "Sessions, tasks, volunteers and resources", "Risk map ranks every entity"],
    action: { type: "navigate", to: "/" },
    actionLabel: "Show the dashboard",
    tone: "ok",
  },
  {
    id: "change",
    index: 2,
    title: "The Change",
    headline: "Main Auditorium → UNAVAILABLE",
    narration:
      "Two hours before doors open, the main auditorium goes dark. NEXUS asks the only question that matters: what does this affect?",
    bullets: ["One operational change", "Nothing is assumed — the graph decides"],
    action: { type: "emergency" },
    actionLabel: "Simulate the impact",
    tone: "bad",
  },
  {
    id: "radius",
    index: 3,
    title: "Blast Radius",
    headline: "Venue → Sessions → Speakers → Volunteers → Resources → Tasks → Comms",
    narration:
      "The dependency graph is traversed live. Every hop is computed from real records — no hardcoded counts, no faked propagation.",
    bullets: ["Sessions relocated", "Speakers and volunteers affected", "Resources, tasks and communications queued"],
    action: { type: "none" },
    actionLabel: "Watch the chain",
    tone: "warn",
  },
  {
    id: "ai",
    index: 4,
    title: "AI Explanation",
    headline: "AI IMPACT ANALYSIS",
    narration:
      "A generated narrative sits on top of verified records. AI output is clearly labelled AI GENERATED, and the SOURCES below it are the exact records it reasoned over.",
    bullets: ["Affected entities", "Reason for every risk", "Sources: verified records"],
    action: { type: "none" },
    actionLabel: "Read the analysis",
    tone: "ai",
  },
  {
    id: "approval",
    index: 5,
    title: "Human Approval",
    headline: "RECOMMENDED ACTIONS → REVIEW → APPLY",
    narration:
      "NEXUS recommends; a human decides. Move a session, reassign a volunteer, update AV, notify participants — nothing is written until the organizer presses Apply changes.",
    bullets: ["Review each recommended action", "The organizer stays in control"],
    action: { type: "none" },
    actionLabel: "Review, then apply",
    tone: "blue",
  },
  {
    id: "execution",
    index: 6,
    title: "Execution",
    headline: "Schedule · Tasks · Volunteers · Communications · Incident",
    narration:
      "On approval the change is applied across the operational state, a critical incident is opened with the full blast radius, and every step is written to the audit trail.",
    bullets: ["Schedule and tasks updated", "Assignments and communications updated", "Incident opened automatically"],
    action: { type: "navigate", to: "/timeline" },
    actionLabel: "Show the audit trail",
    tone: "ok",
  },
  {
    id: "notion",
    index: 7,
    title: "Notion",
    headline: "Sync Center",
    narration:
      "Records synchronize to the Notion knowledge layer. If a real workspace is connected this is a live API sync; if not, NEXUS says DEMO NOTION MODE — it never fakes a connection.",
    bullets: ["Records synchronized", "Sync timestamp and direction", "Success / failure per record"],
    action: { type: "navigate", to: "/sync" },
    actionLabel: "Open Sync Center",
    tone: "ai",
  },
  {
    id: "knowledge",
    index: 8,
    title: "Knowledge",
    headline: "Main Auditorium Venue Change",
    narration:
      "The incident becomes reusable knowledge for the next event: Problem, Impact, Resolution and Lesson Learned — one story from event to knowledge.",
    bullets: ["Incident → Knowledge", "Problem / Impact / Resolution / Lesson"],
    action: { type: "navigate", to: "/knowledge" },
    actionLabel: "Open Knowledge",
    tone: "ai",
  },
  {
    id: "roles",
    index: 9,
    title: "Role Change",
    headline: "One dataset, three experiences",
    narration:
      "The same operational truth, shaped by role. The organizer sees impact, risk and approval; the coordinator sees reassignments and workload; the volunteer sees just their task and shift.",
    bullets: ["Organizer · impact / risk / approval", "Coordinator · reassignments / workload", "Volunteer · their task / shift"],
    action: { type: "role", role: "volunteer_coordinator" },
    actionLabel: "Switch role",
    tone: "blue",
    roleChoices: [
      { role: "organizer", label: "Organizer", to: "/" },
      { role: "volunteer_coordinator", label: "Volunteer Coordinator", to: "/volunteers" },
      { role: "volunteer", label: "Volunteer", to: "/me" },
    ],
  },
  {
    id: "end",
    index: 10,
    title: "End",
    headline: "When one thing changes, NEXUS shows everything affected — before it becomes a problem.",
    narration:
      "Problem → Intelligence → Action → Notion → Knowledge. That is the whole story.",
    action: { type: "navigate", to: "/" },
    actionLabel: "Back to dashboard",
    tone: "ok",
  },
];

export const DEMO_SCENE_COUNT = DEMO_SCENES.length;

export function sceneAt(step: number): DemoScene {
  const i = Math.max(0, Math.min(DEMO_SCENES.length - 1, step));
  return DEMO_SCENES[i];
}
