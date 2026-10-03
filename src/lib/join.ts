import type { JoinRole, JoinSession, NexusData } from "@/types";

/**
 * NEXUS QR JOIN (Part 3)
 * ======================================================================
 * A simulated onboarding flow: the organizer generates an EVENT QR, a volunteer
 * scans it and instantly sees the event, available roles, shift, location and
 * tasks. Demo-mode by design — no authentication complexity is introduced.
 */

export function joinSessionFor(data: NexusData): JoinSession {
  const assignedByTeam = (teamId: string) => data.volunteers.filter((v) => v.teamId === teamId && v.status === "assigned").length;

  const roles: JoinRole[] = data.teams
    .slice(0, 6)
    .map((t) => {
      const filled = assignedByTeam(t.id);
      const spots = Math.max(2, 6 - filled);
      const venue = data.venues.find((v) => v.id === data.sessions.find((s) => s.teamId === t.id)?.venueId);
      return {
        id: t.id,
        role: t.name,
        shift: t.id === "t-reg" ? "Shift A · 08:00–13:00" : t.id === "t-sec" ? "Shift C · 17:00–22:00" : "Shift B · 12:00–18:00",
        location: venue?.name ?? "Main Campus",
        spots,
        filled,
      };
    });

  return {
    id: "join-ev1",
    eventName: data.event.name,
    eventDate: data.event.date,
    venueName: data.venues.find((v) => v.id === data.event.venueId)?.name ?? "Main Auditorium",
    roles,
    instructions: [
      "Scan in at the volunteer desk on arrival.",
      "Collect your radio and hi-vis vest from the equipment store.",
      "Attend the shift briefing 20 minutes before your window opens.",
      "Escalate blockers to your Volunteer Coordinator, not to attendees.",
    ],
  };
}

/**
 * Deterministic pseudo-QR matrix. This is a SIMULATED code for the demo — it is
 * not a spec-compliant QR payload, and is never claimed to be. It renders a
 * recognisable finder-patterned grid so the onboarding story is visually clear.
 */
export function pseudoQrMatrix(seed: string, size = 21): boolean[][] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };

  const m: boolean[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) m[y][x] = rand() > 0.52;
  }

  // Finder patterns in three corners.
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        m[oy + y][ox + x] = edge || core;
      }
    }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);

  // Quiet ring around finders.
  for (let i = 0; i < 8; i++) {
    m[7][i] = false;
    m[i][7] = false;
    m[7][size - 1 - i] = false;
    m[i][size - 8] = false;
    m[size - 8][i] = false;
  }
  return m;
}