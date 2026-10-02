import type { AssignmentRecommendation, CandidateScore, NexusData, ShiftBand, Volunteer } from "@/types";
import { NOW } from "@/data/seed";

/**
 * NEXUS RECOMMENDATION ENGINE (Part 2)
 * ======================================================================
 * Deterministic, explainable volunteer matching.
 *
 * Inputs (per the brief): skills, availability, current workload, role
 * requirements, location and shift overlap.
 *
 * HARD RULE: this engine RECOMMENDS. It never assigns. A human must move
 * through RECOMMEND → REVIEW → ASSIGN.
 */

const WEIGHTS = {
  skill: 0.34,
  availability: 0.18,
  capacity: 0.2,
  shift: 0.16,
  distance: 0.12,
};

const ZONE_GROUPS: Record<string, string> = {
  "Main Stage": "convention",
  "Convention Zone": "convention",
  "Arena Zone": "arena",
  "Block C": "blocks",
  "Block B": "blocks",
  "Central Lawn": "outdoor",
};

const DISTANCE_SCORE = { low: 100, medium: 65, high: 35 } as const;

export interface CandidateCriteria {
  requiredSkills: string[];
  targetShift: ShiftBand;
  targetZone: string;
  excludeIds?: string[];
}

export function scoreVolunteer(v: Volunteer, criteria: CandidateCriteria): CandidateScore {
  const required = criteria.requiredSkills.map((s) => s.toLowerCase());
  const have = v.skills.map((s) => s.toLowerCase());
  const matched = required.filter((r) => have.some((h) => h.includes(r) || r.includes(h)));
  const skillMatch = required.length ? Math.round((matched.length / required.length) * 100) : 70;

  const availability =
    v.status === "available" ? 100 : v.status === "standby" ? 90 : v.status === "assigned" ? 70 : 30;

  const capacity = Math.max(0, 100 - v.workload);

  const shiftOverlap =
    v.shift === criteria.targetShift || v.shift === "FULL"
      ? 100
      : adjacentShifts(v.shift, criteria.targetShift)
        ? 60
        : 20;

  const distance: CandidateScore["distance"] =
    v.zone === criteria.targetZone
      ? "low"
      : ZONE_GROUPS[v.zone] === ZONE_GROUPS[criteria.targetZone]
        ? "medium"
        : "high";

  const total = Math.round(
    skillMatch * WEIGHTS.skill +
      availability * WEIGHTS.availability +
      capacity * WEIGHTS.capacity +
      shiftOverlap * WEIGHTS.shift +
      DISTANCE_SCORE[distance] * WEIGHTS.distance,
  );

  const reasons = [
    required.length
      ? `Skill match ${skillMatch}% (${matched.length}/${required.length}: ${matched.join(", ") || "none"})`
      : "No specific skill requirement recorded for this role",
    `Availability ${availability}% · status "${v.status}"`,
    `Current workload ${v.workload}% → ${capacity}% spare capacity`,
    shiftOverlap === 100 ? "Shift overlaps exactly" : `Shift overlap ${shiftOverlap}% (${v.shift} vs ${criteria.targetShift})`,
    `Travel distance ${distance} (${v.zone} → ${criteria.targetZone})`,
  ];

  return {
    volunteerId: v.id,
    name: v.name,
    role: v.role,
    skillMatch,
    availability,
    workload: v.workload,
    distance,
    shiftOverlap,
    total,
    reasons,
  };
}

export function recommendVolunteers(
  data: NexusData,
  criteria: CandidateCriteria,
  context: string,
  role: string,
  limit = 3,
): AssignmentRecommendation {
  const exclude = new Set(criteria.excludeIds ?? []);
  const scored = data.volunteers
    .filter((v) => !exclude.has(v.id))
    .map((v) => scoreVolunteer(v, criteria))
    .sort((a, b) => b.total - a.total);

  return {
    role,
    context,
    requiredSkills: criteria.requiredSkills,
    targetShift: criteria.targetShift,
    targetZone: criteria.targetZone,
    best: scored[0] ?? null,
    alternatives: scored.slice(1, 1 + limit),
  };
}

/** Derive a replacement recommendation for a specific volunteer's assignment. */
export function recommendReplacement(data: NexusData, volunteerId: string): AssignmentRecommendation | null {
  const subject = data.volunteers.find((v) => v.id === volunteerId);
  if (!subject) return null;
  const team = data.teams.find((t) => t.id === subject.teamId);
  const requiredSkills = subject.skills;
  const targetShift = subject.shift;
  const targetZone = subject.zone;
  return recommendVolunteers(
    data,
    { requiredSkills, targetShift, targetZone, excludeIds: [subject.id] },
    `Replacing ${subject.name} (${subject.role}, ${team?.name ?? "department"}) currently at ${subject.currentAssignment}`,
    subject.role,
  );
}

/** Derive the coverage recommendation for a session that lacks volunteer cover. */
export function recommendForSession(data: NexusData, sessionId: string): AssignmentRecommendation | null {
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const venue = data.venues.find((v) => v.id === session.venueId);
  const team = data.teams.find((t) => t.id === session.teamId);
  const teamVolunteers = data.volunteers.filter((v) => v.teamId === session.teamId);
  const requiredSkills = [...new Set(teamVolunteers.flatMap((v) => v.skills))].slice(0, 3);
  const assignedIds = new Set(
    data.tasks.filter((t) => t.sessionId === session.id && t.ownerKind === "volunteer").map((t) => t.ownerId),
  );
  return recommendVolunteers(
    data,
    {
      requiredSkills,
      targetShift: shiftForHour(session.startsAt),
      targetZone: venue ? venue.name.split(" ")[0] : "Main Stage",
      excludeIds: [...assignedIds],
    },
    `Coverage gap for ${session.title} at ${venue?.name ?? "venue TBD"} · owned by ${team?.name ?? "operations"}`,
    `${session.track} session cover`,
  );
}

/** Every open coverage gap in the event, each with a recommendation. */
export function coverageGaps(data: NexusData): AssignmentRecommendation[] {
  const now = new Date(NOW).getTime();
  return data.sessions
    .filter((s) => s.status !== "completed" && new Date(s.endsAt).getTime() >= now)
    .filter((s) => {
      const tasks = data.tasks.filter((t) => t.sessionId === s.id);
      return tasks.length === 0 || !tasks.some((t) => t.ownerKind === "volunteer");
    })
    .map((s) => recommendForSession(data, s.id))
    .filter(Boolean) as AssignmentRecommendation[];
}

/* ------------------------------- helpers ------------------------------- */

function shiftForHour(iso: string): ShiftBand {
  const h = Number(iso.slice(11, 13));
  if (h < 12) return "A";
  if (h < 17) return "B";
  return "C";
}

function adjacentShifts(a: ShiftBand, b: ShiftBand): boolean {
  const order: ShiftBand[] = ["A", "B", "C"];
  const ai = order.indexOf(a);
  const bi = order.indexOf(b);
  if (ai === -1 || bi === -1) return false;
  return Math.abs(ai - bi) === 1;
}
