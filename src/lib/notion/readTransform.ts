import type { NexusData, Priority, TaskStatus, SessionStatus, Volunteer, ResourceStatus, IncidentStatus, Severity, NotionTrace } from "@/types";
import type { PushRowResult, ReadDatabaseResult } from "./client";

/**
 * NOTION → APP TRANSFORM (Part 3)
 * ======================================================================
 * Converts the raw rows returned by `/api/notion/read` back into updates on the
 * internal NEXUS data model. Only fields that NEXUS understands are applied, and
 * every applied row carries a Notion trace (page id, database id, timestamp) so
 * the UI can show `SOURCE: NOTION`.
 *
 * This is a pure function: it returns a new dataset plus a human-readable list
 * of the changes it reconciled. It never mutates its input.
 */

export interface AppliedRead {
  database: string;
  key: string;
  entityId: string;
  entityLabel: string;
  fields: string[];
  pageId: string;
  databaseId: string;
}

export interface ReadTransformResult {
  data: NexusData;
  applied: AppliedRead[];
}

/** Database key → the collection it maps to (for trace write-back). */
export const COLLECTION_BY_DB_KEY: Record<string, keyof NexusData | "event"> = {
  events: "event",
  venues: "venues",
  sessions: "sessions",
  speakers: "speakers",
  teams: "teams",
  members: "members",
  participants: "participants",
  volunteers: "volunteers",
  tasks: "tasks",
  resources: "resources",
  incidents: "incidents",
  dependencies: "dependencies",
  communications: "communications",
  knowledge: "knowledge",
};

const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const TASK_STATUSES: TaskStatus[] = ["not_started", "in_progress", "blocked", "at_risk", "completed"];
const SESSION_STATUSES: SessionStatus[] = ["scheduled", "live", "delayed", "completed", "at_risk"];
const VOL_STATUSES: Volunteer["status"][] = ["assigned", "standby", "available", "off_duty"];
const RES_STATUSES: ResourceStatus[] = ["available", "assigned", "in_transit", "maintenance"];
const INC_STATUSES: IncidentStatus[] = ["open", "investigating", "mitigated", "resolved"];
const SEVERITIES: Severity[] = ["critical", "warning", "info"];
const PRIORITIES: Priority[] = ["low", "medium", "high", "critical"];

function pick<T extends string>(allowed: T[], value: unknown, fallback: T): T {
  const v = str(value).trim() as T;
  return allowed.includes(v) ? v : fallback;
}

function traceFor(row: Record<string, unknown>, databaseId: string): NotionTrace {
  return {
    notionPageId: str(row.__pageId) || undefined,
    notionDatabaseId: databaseId || str(row.__databaseId) || undefined,
    lastSyncedAt: new Date().toISOString(),
    syncStatus: "synced",
    source: "notion",
  };
}

/**
 * Apply a single database's rows onto the dataset. `update` mutates a working
 * copy of the relevant collection; returns the list of applied changes.
 */
export function applyNotionRead(data: NexusData, databases: ReadDatabaseResult[]): ReadTransformResult {
  let next: NexusData = data;
  const applied: AppliedRead[] = [];

  const patchById = <T extends { id: string }>(
    list: T[],
    id: string,
    patch: Partial<T>,
  ): { list: T[]; changed: boolean; before?: T } => {
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return { list, changed: false };
    const before = list[idx];
    const merged = { ...before, ...patch };
    const list2 = [...list];
    list2[idx] = merged;
    return { list: list2, changed: true, before };
  };

  for (const db of databases) {
    if (db.error) continue;
    const databaseId = db.databaseId || "";
    for (const row of db.rows) {
      // Resolve the domain id from the database's primary-key style column.
      const domainId = resolveDomainId(row);

      switch (db.key) {
        case "tasks": {
          const patch: Record<string, unknown> = {};
          if (row.Status) patch.status = pick(TASK_STATUSES, row.Status, "not_started");
          if (row.Progress != null) patch.progress = num(row.Progress);
          if (row.Deadline) patch.deadline = str(row.Deadline);
          if (row.Priority) patch.priority = pick(PRIORITIES, row.Priority, "medium");
          const r = patchById(next.tasks, domainId, { ...patch, notion: traceFor(row, databaseId) });
          if (r.changed) {
            next = { ...next, tasks: r.list };
            applied.push(rec(db, domainId, r.before?.title ?? domainId, Object.keys(patch), row, databaseId));
          }
          break;
        }
        case "sessions": {
          const patch: Record<string, unknown> = {};
          if (row.Status) patch.status = pick(SESSION_STATUSES, row.Status, "scheduled");
          if (row.Starts) patch.startsAt = str(row.Starts);
          if (row.Ends) patch.endsAt = str(row.Ends);
          if (row.Risk) patch.riskLevel = pick(SEVERITIES, row.Risk, "info");
          const r = patchById(next.sessions, domainId, { ...patch, notion: traceFor(row, databaseId) });
          if (r.changed) {
            next = { ...next, sessions: r.list };
            applied.push(rec(db, domainId, r.before?.title ?? domainId, Object.keys(patch), row, databaseId));
          }
          break;
        }
        case "speakers": {
          const patch: Record<string, unknown> = {};
          if (row.Confirmed != null) patch.confirmed = Boolean(row.Confirmed);
          if (row.Arrival) patch.arrivalStatus = pick(["confirmed", "pending", "delayed"] as const, row.Arrival, "pending");
          const r = patchById(next.speakers, domainId, { ...patch, notion: traceFor(row, databaseId) });
          if (r.changed) {
            next = { ...next, speakers: r.list };
            applied.push(rec(db, domainId, r.before?.name ?? domainId, Object.keys(patch), row, databaseId));
          }
          break;
        }
        case "volunteers": {
          const patch: Record<string, unknown> = {};
          if (row.Status) patch.status = pick(VOL_STATUSES, row.Status, "available");
          if (row.Workload != null) patch.workload = num(row.Workload);
          if (row.Assignment != null) patch.currentAssignment = str(row.Assignment);
          if (row.Zone) patch.zone = str(row.Zone);
          const r = patchById(next.volunteers, domainId, { ...patch, notion: traceFor(row, databaseId) });
          if (r.changed) {
            next = { ...next, volunteers: r.list };
            applied.push(rec(db, domainId, r.before?.name ?? domainId, Object.keys(patch), row, databaseId));
          }
          break;
        }
        case "resources": {
          const patch: Record<string, unknown> = {};
          if (row.Status) patch.status = pick(RES_STATUSES, row.Status, "available");
          if (row.Available != null) patch.available = num(row.Available);
          if (row.Assigned != null) patch.assigned = num(row.Assigned);
          const r = patchById(next.resources, domainId, { ...patch, notion: traceFor(row, databaseId) });
          if (r.changed) {
            next = { ...next, resources: r.list };
            applied.push(rec(db, domainId, r.before?.name ?? domainId, Object.keys(patch), row, databaseId));
          }
          break;
        }
        case "incidents": {
          const patch: Record<string, unknown> = {};
          if (row.Status) patch.status = pick(INC_STATUSES, row.Status, "open");
          if (row.Severity) patch.severity = pick(SEVERITIES, row.Severity, "warning");
          if (row.Notes != null) patch.notes = str(row.Notes);
          const r = patchById(next.incidents, domainId, { ...patch, notion: traceFor(row, databaseId) });
          if (r.changed) {
            next = { ...next, incidents: r.list };
            applied.push(rec(db, domainId, r.before?.title ?? domainId, Object.keys(patch), row, databaseId));
          }
          break;
        }
        case "communications": {
          const patch: Record<string, unknown> = {};
          if (row.Status) patch.status = pick(["drafted", "scheduled", "sent"] as const, row.Status, "drafted");
          const r = patchById(next.communications, domainId, { ...patch, notion: traceFor(row, databaseId) });
          if (r.changed) {
            next = { ...next, communications: r.list };
            applied.push(rec(db, domainId, r.before?.subject ?? domainId, Object.keys(patch), row, databaseId));
          }
          break;
        }
        case "knowledge": {
          const patch: Record<string, unknown> = {};
          if (row.Summary != null) patch.summary = str(row.Summary);
          if (row.Title) patch.title = str(row.Title);
          const r = patchById(next.knowledge, domainId, { ...patch, notion: traceFor(row, databaseId) });
          if (r.changed) {
            next = { ...next, knowledge: r.list };
            applied.push(rec(db, domainId, r.before?.title ?? domainId, Object.keys(patch), row, databaseId));
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return { data: next, applied };
}

/**
 * Attach Notion traces to the records that were just written, using the page
 * ids reported by a real push. This is what lets the UI say `SOURCE: NOTION`
 * and lets later updates address the same Notion page.
 */
export function attachNotionTraces(data: NexusData, results: PushRowResult[], syncedAt: string): { data: NexusData; traced: number } {
  const traces = new Map<string, NotionTrace>();
  for (const r of results) {
    if (r.status === "failed" || !r.pageId) continue;
    traces.set(`${r.key}:${r.entityId}`, {
      notionPageId: r.pageId,
      notionDatabaseId: r.databaseId,
      lastSyncedAt: syncedAt,
      syncStatus: "synced",
      source: "nexus",
    });
  }
  if (!traces.size) return { data, traced: 0 };

  let traced = 0;
  const withTrace = <T extends { id: string }>(key: string, list: T[]): T[] =>
    list.map((r) => {
      const t = traces.get(`${key}:${r.id}`);
      if (!t) return r;
      traced += 1;
      return { ...r, notion: t } as T;
    });

  const next: NexusData = {
    ...data,
    venues: withTrace("venues", data.venues),
    speakers: withTrace("speakers", data.speakers),
    sessions: withTrace("sessions", data.sessions),
    teams: withTrace("teams", data.teams),
    members: withTrace("members", data.members),
    volunteers: withTrace("volunteers", data.volunteers),
    participants: withTrace("participants", data.participants),
    tasks: withTrace("tasks", data.tasks),
    resources: withTrace("resources", data.resources),
    incidents: withTrace("incidents", data.incidents),
    dependencies: withTrace("dependencies", data.dependencies),
    communications: withTrace("communications", data.communications),
    knowledge: withTrace("knowledge", data.knowledge),
  };
  return { data: next, traced };
}

function rec(
  db: ReadDatabaseResult,
  entityId: string,
  entityLabel: string,
  fields: string[],
  row: Record<string, unknown>,
  databaseId: string,
): AppliedRead {
  return {
    database: db.name,
    key: db.key,
    entityId,
    entityLabel,
    fields: fields.length ? fields : ["edited in Notion"],
    pageId: str(row.__pageId),
    databaseId,
  };
}

/**
 * Resolve the internal domain id for a Notion row. The mapping layer emits a
 * `… ID` primary-key column (e.g. "Task ID"), so we read whichever such column
 * exists. Falls back to the page id when nothing else is present.
 */
function resolveDomainId(row: Record<string, unknown>): string {
  const idKey = Object.keys(row).find((k) => k !== "__pageId" && k !== "__databaseId" && k.endsWith(" ID"));
  if (idKey) return str(row[idKey]);
  return str(row.__pageId);
}
