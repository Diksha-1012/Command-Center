import type { NexusData, RebalanceMove, TeamLoad } from "@/types";
import { NOW } from "@/data/seed";
import { isOverdue } from "./format";

/**
 * NEXUS WORKLOAD ANALYZER (Part 2)
 * ======================================================================
 * Team load is derived from the people actually rostered (mean volunteer
 * workload) blended with live task pressure (open + overdue tasks).
 * No magic numbers in the UI — every load has a `drivers` explanation.
 */

const OPEN_TASK_WEIGHT = 10; // % load contributed per open task
const HIGH_PRIORITY_WEIGHT = 8; // extra load per high/critical open task
const OVERDUE_WEIGHT = 10;
const BLOCKED_WEIGHT = 12;
const OVERLOAD_THRESHOLD = 78;

export function teamLoadMap(data: NexusData): TeamLoad[] {
  return data.teams
    .map((team) => {
      const volunteers = data.volunteers.filter((v) => v.teamId === team.id);
      const tasks = data.tasks.filter((t) => t.teamId === team.id);
      const openTasks = tasks.filter((t) => t.status !== "completed");
      const overdue = openTasks.filter((t) => isOverdue(t.deadline, NOW));
      const blocked = openTasks.filter((t) => t.status === "blocked");
      const highPriority = openTasks.filter((t) => t.priority === "critical" || t.priority === "high");

      const avgWorkload = volunteers.length
        ? volunteers.reduce((n, v) => n + v.workload, 0) / volunteers.length
        : 0;
      const taskPressure = Math.min(
        100,
        openTasks.length * OPEN_TASK_WEIGHT +
          highPriority.length * HIGH_PRIORITY_WEIGHT +
          overdue.length * OVERDUE_WEIGHT +
          blocked.length * BLOCKED_WEIGHT,
      );
      const load = Math.round(Math.min(100, avgWorkload * 0.6 + taskPressure * 0.4));

      const drivers: string[] = [];
      if (volunteers.length) drivers.push(`${volunteers.length} rostered volunteers averaging ${Math.round(avgWorkload)}% workload`);
      drivers.push(`${openTasks.length} open tasks (${tasks.length} total in department)`);
      if (highPriority.length) drivers.push(`${highPriority.length} high/critical priority task${highPriority.length === 1 ? "" : "s"}`);
      if (overdue.length) drivers.push(`${overdue.length} overdue`);
      if (blocked.length) drivers.push(`${blocked.length} blocked by an upstream dependency`);

      return {
        teamId: team.id,
        name: team.name,
        load,
        volunteers: volunteers.length,
        openTasks: openTasks.length,
        overloaded: load > OVERLOAD_THRESHOLD,
        drivers,
      };
    })
    .sort((a, b) => b.load - a.load);
}

/**
 * Suggest human-reviewable rebalancing moves: take the most-loaded volunteer
 * from an overloaded team and propose them to the least-loaded team that
 * already depends on their skills.
 */
export function rebalanceSuggestions(data: NexusData, loads?: TeamLoad[]): RebalanceMove[] {
  const map = loads ?? teamLoadMap(data);
  const overloaded = map.filter((t) => t.overloaded);
  const receivers = [...map].filter((t) => t.load < 68).sort((a, b) => a.load - b.load);
  const moves: RebalanceMove[] = [];

  for (const from of overloaded) {
    const candidates = data.volunteers
      .filter((v) => v.teamId === from.teamId)
      .sort((a, b) => b.workload - a.workload);

    for (const candidate of candidates) {
      // Prefer a receiving team that already uses one of the candidate's skills;
      // otherwise fall back to the least-loaded team with a review disclaimer.
      const skillMatch = receivers.find(
        (r) =>
          r.teamId !== from.teamId &&
          data.volunteers.some((v) => v.teamId === r.teamId && v.skills.some((s) => candidate.skills.includes(s))),
      );
      const receiver = skillMatch ?? receivers.find((r) => r.teamId !== from.teamId);
      if (!receiver) continue;

      // Never move a candidate onto a team that would immediately overload.
      if (from.load - receiver.load <= 0) continue;

      const sharedSkills = candidate.skills.slice(0, 2).join(", ");
      const expectedDelta = Math.max(1, Math.round((from.load - receiver.load) / 4));
      moves.push({
        id: `rb-${from.teamId}-${candidate.id}`,
        fromTeamId: from.teamId,
        toTeamId: receiver.teamId,
        volunteerId: candidate.id,
        volunteerName: candidate.name,
        reason: skillMatch
          ? `${from.name} runs at ${from.load}% while ${receiver.name} sits at ${receiver.load}%. ${candidate.name} carries a ${candidate.workload}% load and shares skills (${sharedSkills}) with the receiving team.`
          : `${from.name} runs at ${from.load}% while ${receiver.name} sits at ${receiver.load}%. ${candidate.name} (${candidate.workload}% load, skills: ${sharedSkills}) has no direct skill overlap — review before moving.`,
        expectedDelta,
      });
      break; // one move per overloaded team keeps the plan reviewable
    }
  }

  return moves;
}
