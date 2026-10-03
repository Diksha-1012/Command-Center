import type { NexusData, Session, ShiftAssignment, Task } from "@/types";

/**
 * NEXUS VOLUNTEER SHIFTS (Part 3)
 * ======================================================================
 * Derives a shift brief for every volunteer from the tasks they own and the
 * sessions those tasks protect — so the volunteer mobile view shows real data,
 * not a separate hardcoded list.
 */

const WINDOWS: Record<string, [string, string]> = {
  A: ["08:00", "13:00"],
  B: ["12:00", "18:00"],
  C: ["17:00", "22:00"],
  FULL: ["08:00", "20:00"],
};

export function shiftsFor(data: NexusData): ShiftAssignment[] {
  return data.volunteers.map((v) => {
    const tasks = data.tasks.filter((t) => t.ownerKind === "volunteer" && t.ownerId === v.id);
    const session =
      data.sessions.find((s) => tasks.some((t) => t.sessionId === s.id)) ??
      data.sessions.find((s) => s.teamId === v.teamId);
    const venue = data.venues.find((x) => x.id === session?.venueId) ?? data.venues.find((x) => x.id === "v-main");
    const [start, end] = WINDOWS[v.shift] ?? WINDOWS.FULL;
    return {
      id: `shift-${v.id}`,
      volunteerId: v.id,
      role: v.role,
      venue: venue?.name ?? "Main Stage",
      venueId: venue?.id ?? "v-main",
      start,
      end,
      taskIds: tasks.map((t) => t.id),
      briefing: `Report to ${v.zone} for the ${v.shift} shift briefing. Escalate blockers to the Volunteer Coordinator.`,
    };
  });
}

export function shiftFor(data: NexusData, volunteerId: string): ShiftAssignment | undefined {
  return shiftsFor(data).find((s) => s.volunteerId === volunteerId);
}

export function sessionForShift(data: NexusData, shift: ShiftAssignment): Session | undefined {
  const tasks = data.tasks.filter((t) => shift.taskIds.includes(t.id));
  return (
    data.sessions.find((s) => tasks.some((t) => t.sessionId === s.id)) ??
    data.sessions.find((s) => s.venueId === shift.venueId)
  );
}

/** Tasks for the "my tasks" checklist, done-first-then-pending like a shift list. */
export function myTasks(data: NexusData, volunteerId: string): Task[] {
  const order = { completed: 0, in_progress: 1, blocked: 2, not_started: 3 } as const;
  return data.tasks
    .filter((t) => t.ownerKind === "volunteer" && t.ownerId === volunteerId)
    .sort((a, b) => order[a.status] - order[b.status] || (a.deadline < b.deadline ? -1 : 1));
}

/** Announcements relevant to a volunteer (broadcasts to all + their team). */
export function announcementsFor(data: NexusData, volunteerId: string) {
  const v = data.volunteers.find((x) => x.id === volunteerId);
  const team = data.teams.find((t) => t.id === v?.teamId);
  return data.communications.filter(
    (c) =>
      c.audience.toLowerCase().includes("all") ||
      (team ? c.audience.toLowerCase().includes(team.name.toLowerCase()) : false),
  );
}