import type { RoleDefinition, RoleId } from "@/types";

/**
 * NEXUS ROLE MODEL (Part 3)
 * ======================================================================
 * The same underlying dataset produces different experiences per role.
 * Routing is filtered by these route lists — the domain data is never
 * duplicated per role.
 */

export const ROLES: RoleDefinition[] = [
  {
    id: "organizer",
    name: "Event Organizer",
    blurb: "Full command: health, impact simulation, risks, teams and reports.",
    routes: ["*"],
    memberId: "m1",
  },
  {
    id: "ops_lead",
    name: "Operations Lead",
    blurb: "Focus on the running order: tasks, schedule, resources and incidents.",
    routes: ["/command", "/schedule", "/tasks", "/resources", "/incidents", "/timeline", "/teams", "/volunteers", "/copilot", "/sync"],
    memberId: "m2",
  },
  {
    id: "volunteer_coordinator",
    name: "Volunteer Coordinator",
    blurb: "Own the roster: volunteer workload, coverage gaps, assignments and shifts.",
    routes: ["/command", "/volunteers", "/teams", "/tasks", "/schedule", "/incidents", "/me", "/copilot", "/sync"],
    memberId: "m8",
  },
  {
    id: "volunteer",
    name: "Volunteer",
    blurb: "Just what you need on shift: your tasks, instructions and announcements.",
    routes: ["/me", "/copilot"],
    memberId: "m8",
    volunteerId: "v1",
  },
];

export const ROLE_BY_ID: Record<RoleId, RoleDefinition> = Object.fromEntries(
  ROLES.map((r) => [r.id, r]),
) as Record<RoleId, RoleDefinition>;

export function canAccess(role: RoleDefinition, path: string): boolean {
  if (role.routes.includes("*")) return true;
  return role.routes.some((r) => path === r || path.startsWith(`${r}/`));
}

/** Where a role lands after switching (first route it owns). */
export function homeFor(role: RoleDefinition): string {
  return role.routes.includes("*") ? "/" : role.routes[0];
}
