import type { MemoryEntry, NexusData } from "@/types";
import { NOTION_DATABASES } from "./schema";

/**
 * NEXUS NOTION MAPPING (Part 3)
 * ======================================================================
 * Pure transform: domain entities → Notion row objects keyed by database.
 * Relations are emitted as id arrays so the server/Notion `relation` properties
 * preserve the graph instead of flattening it.
 */

export type NotionRow = Record<string, unknown>;

export function mapDataToRows(data: NexusData, memory: MemoryEntry[] = []): Record<string, NotionRow[]> {
  return {
    events: [
      {
        "Event ID": data.event.id,
        Name: data.event.name,
        Tagline: data.event.tagline,
        Date: data.event.date,
        Phase: data.event.phase,
        Venue: [data.event.venueId],
        Participants: data.event.participantTarget,
        "Volunteer Pool": data.event.volunteerPool,
        Organizers: data.event.organizers,
      },
    ],
    venues: data.venues.map((v) => ({
      "Venue ID": v.id,
      Name: v.name,
      Building: v.building,
      Capacity: v.capacity,
      Utilization: v.utilization,
      Status: v.status,
      Features: v.features,
      Sessions: data.sessions.filter((s) => s.venueId === v.id).map((s) => s.id),
    })),
    sessions: data.sessions.map((s) => ({
      "Session ID": s.id,
      Title: s.title,
      Track: s.track,
      Event: [s.eventId],
      Venue: [s.venueId],
      Speakers: s.speakerIds,
      Team: [s.teamId],
      Resources: s.resourceIds,
      Tasks: data.tasks.filter((t) => t.sessionId === s.id).map((t) => t.id),
      Starts: s.startsAt,
      Ends: s.endsAt,
      Status: s.status,
      "Expected Attendance": s.expectedAttendance,
      Risk: s.riskLevel,
    })),
    speakers: data.speakers.map((sp) => ({
      "Speaker ID": sp.id,
      Name: sp.name,
      Title: sp.title,
      Organisation: sp.org,
      Confirmed: sp.confirmed,
      Arrival: sp.arrivalStatus,
      Sessions: data.sessions.filter((s) => s.speakerIds.includes(sp.id)).map((s) => s.id),
    })),
    teams: data.teams.map((t) => ({
      "Team ID": t.id,
      Name: t.name,
      Lead: [t.leadMemberId],
      Description: t.description,
      Status: t.status,
      Members: data.members.filter((m) => m.teamId === t.id).map((m) => m.id),
      Volunteers: data.volunteers.filter((v) => v.teamId === t.id).map((v) => v.id),
    })),
    members: data.members.map((m) => ({
      "Member ID": m.id,
      Name: m.name,
      Role: m.role,
      Team: [m.teamId],
      Email: `mailto:${m.email}`,
      "Owned Tasks": data.tasks.filter((t) => t.ownerKind === "member" && t.ownerId === m.id).map((t) => t.id),
    })),
    participants: data.participants.map((p) => ({
      "Participant ID": p.id,
      Name: p.name,
      Email: `mailto:${p.email}`,
      "Ticket Type": p.ticketType,
      Status: p.status,
      Session: p.sessionId ? [p.sessionId] : [],
      Team: p.teamId ? [p.teamId] : [],
      "Checked In At": p.checkedInAt ?? null,
    })),
    volunteers: data.volunteers.map((v) => ({
      "Volunteer ID": v.id,
      Name: v.name,
      Role: v.role,
      Team: [v.teamId],
      Skills: v.skills,
      Availability: v.availability,
      Assignment: v.currentAssignment,
      Workload: v.workload,
      Status: v.status,
      Zone: v.zone,
      Shift: v.shift,
      Assignments: data.tasks.filter((t) => t.ownerKind === "volunteer" && t.ownerId === v.id).map((t) => t.id),
    })),
    tasks: data.tasks.map((t) => ({
      "Task ID": t.id,
      Title: t.title,
      Description: t.description,
      Owner: [t.ownerId],
      Department: t.department,
      Team: [t.teamId],
      Priority: t.priority,
      Status: t.status,
      Deadline: t.deadline,
      Progress: t.progress,
      Session: t.sessionId ? [t.sessionId] : [],
      Resource: t.resourceId ? [t.resourceId] : [],
      Dependencies: t.dependencyIds,
    })),
    resources: data.resources.map((r) => ({
      "Resource ID": r.id,
      Name: r.name,
      Category: r.category,
      Quantity: r.quantity,
      Available: r.available,
      Assigned: r.assigned,
      Location: r.location,
      Status: r.status,
      Sessions: data.sessions.filter((s) => s.resourceIds.includes(r.id)).map((s) => s.id),
    })),
    incidents: data.incidents.map((i) => ({
      "Incident ID": i.id,
      Title: i.title,
      Severity: i.severity,
      Location: i.location,
      Status: i.status,
      Owner: [i.ownerId],
      Session: i.relatedSessionId ? [i.relatedSessionId] : [],
      Resource: i.relatedResourceId ? [i.relatedResourceId] : [],
      "Reported At": i.timestamp,
      Notes: i.notes,
    })),
    dependencies: data.dependencies.map((d) => ({
      "Dependency ID": d.id,
      Name: `${d.source.label} → ${d.target.label}`,
      Source: `${d.source.kind}:${d.source.id}`,
      Target: `${d.target.kind}:${d.target.id}`,
      Type: d.type,
      Severity: d.severity,
      Description: d.description,
    })),
    communications: data.communications.map((c) => ({
      "Communication ID": c.id,
      Subject: c.subject,
      Channel: c.channel,
      Audience: c.audience,
      Status: c.status,
      "Scheduled At": c.scheduledAt,
      Session: c.relatedSessionId ? [c.relatedSessionId] : [],
    })),
    knowledge: [
      ...data.knowledge.map((k) => ({
        "Knowledge ID": k.id,
        Title: k.title,
        Category: k.category,
        Summary: k.summary,
        Kind: "note",
        Source: "Knowledge base",
        Reusable: true,
        "Captured At": k.updatedAt,
        "Linked Record": k.linkedEntity ? `${k.linkedEntity.kind}:${k.linkedEntity.id}` : "",
      })),
      ...memory.map((m) => ({
        "Knowledge ID": m.id,
        Title: m.title,
        Category: m.kind,
        Summary: m.body,
        Kind: m.kind,
        Source: m.source,
        Reusable: m.reusable,
        "Captured At": m.capturedAt,
        "Linked Record": m.related[0] ? `${m.related[0].kind}:${m.related[0].id}` : "",
      })),
    ],
  };
}

/** Row counts per database key — drives the sync center + wizard previews. */
export function rowCounts(rows: Record<string, NotionRow[]>): Record<string, number> {
  return Object.fromEntries(NOTION_DATABASES.map((d) => [d.key, rows[d.key]?.length ?? 0]));
}

/** Total records across every mapped database. */
export function totalRows(rows: Record<string, NotionRow[]>): number {
  return Object.values(rows).reduce((n, r) => n + r.length, 0);
}