import type {
  DatabaseSyncState,
  Health,
  MemoryEntry,
  NexusData,
  NotionSyncState,
  SyncLogEntry,
  SyncOp,
  SyncStats,
} from "@/types";
import { NOTION_DATABASES } from "./schema";
import { mapDataToRows } from "./mapping";

/**
 * NEXUS NOTION SYNC ENGINE (Part 3)
 * ======================================================================
 * Produces an honest sync model:
 *
 *   APP → NOTION   push the mapped rows (create / update per database)
 *   NOTION → APP   pull edits made inside Notion and reconcile them locally
 *
 * In DEMO mode a deterministic simulation runs (clearly labelled "DEMO DATA").
 * In LIVE mode the same accounting is applied to the counts reported by the
 * server proxy (`pushToNotion` / `pullFromNotion`). The state shape is identical
 * either way, so the Sync Center never lies about provenance.
 */

export function initialSyncState(): NotionSyncState {
  const databases: DatabaseSyncState[] = NOTION_DATABASES.map((d) => ({
    id: d.key,
    name: d.name,
    icon: d.icon,
    mappedEntity: d.mappedEntity,
    rows: 0,
    synced: 0,
    failed: 0,
    lastSyncedAt: null,
  }));
  return {
    status: "idle",
    health: "warning",
    lastSyncAt: null,
    stats: { created: 0, updated: 0, failed: 0, pending: 0, recordsSynced: 0 },
    databases,
    recentOps: [],
    log: [],
    error: null,
  };
}

function statsFor(databases: DatabaseSyncState[], prevSynced: SyncStats | null): SyncStats {
  const total = databases.reduce((n, d) => n + d.synced, 0);
  const failed = databases.reduce((n, d) => n + d.failed, 0);
  // First successful run → everything is a CREATE. Later runs → UPDATEs, with
  // newly-added rows counted as CREATEs.
  const created = prevSynced ? Math.max(0, total - prevSynced.recordsSynced) : total;
  const updated = prevSynced ? total - created : 0;
  return { created, updated, failed, pending: 0, recordsSynced: total };
}

export interface SyncOutcome {
  sync: NotionSyncState;
  /** The durable record of every write, newest first. */
  ops: SyncOp[];
  pulled: { database: string; entityId: string; entityLabel: string; fields: string[] }[];
}

/**
 * Deterministic demo sync. `direction` models both halves of the workflow:
 *  - the push half always runs (created/updated accounting per database)
 *  - the pull half returns a small, realistic set of Notion-side edits so the
 *    NOTION → APP leg is visible in the Sync Center.
 */
export function runDemoSync(
  data: NexusData,
  memory: MemoryEntry[],
  prev: NotionSyncState,
  direction: "both" | "push" | "pull" = "both",
  breach = false,
): SyncOutcome {
  const rows = mapDataToRows(data, memory);
  const now = new Date().toISOString();
  const databases: DatabaseSyncState[] = NOTION_DATABASES.map((d) => {
    const count = rows[d.key]?.length ?? 0;
    const previous = prev.databases.find((x) => x.id === d.key);
    const syncedRows = direction === "pull" ? (previous?.synced ?? 0) : count;
    return {
      id: d.key,
      name: d.name,
      icon: d.icon,
      mappedEntity: d.mappedEntity,
      rows: count,
      synced: breach ? Math.max(0, syncedRows - 1) : syncedRows,
      failed: breach && d.key === "communications" ? 1 : 0,
      lastSyncedAt: now,
    };
  });

  const stats = statsFor(databases, direction === "pull" ? prev.stats : prev.lastSyncAt ? prev.stats : null);
  const ops = buildOps(data, memory, prev, direction, now);
  const pulled = direction === "pull" || direction === "both" ? buildPulled(data) : [];

  const log: SyncLogEntry[] = [
    {
      id: `log-${now}`,
      at: now,
      level: breach ? ("warn" as const) : ("info" as const),
      message: breach
        ? `Sync completed with ${stats.failed} failed write(s) in Communications. Retry scheduled.`
        : `Sync completed · ${stats.created} created · ${stats.updated} updated across ${databases.length} databases.`,
    },
    ...(pulled.length
      ? [
          {
            id: `log-${now}-pull`,
            at: now,
            level: "info" as const,
            message: `${pulled.length} change(s) pulled from Notion → app state reconciled.`,
          },
        ]
      : []),
    ...prev.log,
  ].slice(0, 24);

  const health: Health = stats.failed > 0 ? "warning" : "healthy";

  return {
    sync: {
      status: stats.failed > 0 ? "error" : "success",
      health,
      lastSyncAt: now,
      stats,
      databases,
      recentOps: [...ops, ...prev.recentOps].slice(0, 60),
      log,
      error: stats.failed > 0 ? `${stats.failed} record(s) failed to write. Local operational state is preserved.` : null,
    },
    ops,
    pulled,
  };
}

function findDb(key: string) {
  return NOTION_DATABASES.find((d) => d.key === key)!;
}

function buildOps(
  data: NexusData,
  memory: MemoryEntry[],
  prev: NotionSyncState,
  direction: "both" | "push" | "pull",
  now: string,
): SyncOp[] {
  const ops: SyncOp[] = [];
  const firstRun = !prev.lastSyncAt;

  const push = (
    dbKey: string,
    entityKind: SyncOp["entityKind"],
    entityId: string,
    label: string,
    fields: string[],
  ) => {
    const db = findDb(dbKey);
    ops.push({
      id: `op-${dbKey}-${entityId}-${ops.length}`,
      at: now,
      direction: "app_to_notion",
      database: db.name,
      entityKind,
      entityId,
      entityLabel: label,
      op: firstRun ? "create" : "update",
      fields,
    });
  };

  if (direction !== "pull") {
    // A representative slice of writes (the Sync Center shows the most recent).
    push("tasks", "task", data.tasks[0]?.id ?? "", data.tasks[0]?.title ?? "", ["Status", "Progress"]);
    push("tasks", "task", data.tasks[1]?.id ?? "", data.tasks[1]?.title ?? "", ["Status", "Owner"]);
    push("sessions", "session", data.sessions[2]?.id ?? "", data.sessions[2]?.title ?? "", ["Venue", "Tasks"]);
    push("volunteers", "volunteer", data.volunteers[0]?.id ?? "", data.volunteers[0]?.name ?? "", ["Workload", "Status"]);
    push("incidents", "incident", data.incidents[0]?.id ?? "", data.incidents[0]?.title ?? "", ["Status", "Notes"]);
    if (memory[0]) push("knowledge", "knowledge", memory[0].id, memory[0].title, ["Summary", "Kind"]);
  }

  if (direction !== "push") {
    for (const p of buildPulled(data)) {
      const kind: SyncOp["entityKind"] =
        p.database === "Tasks" ? "task" : p.database === "Sessions" ? "session" : "volunteer";
      ops.push({
        id: `op-pull-${p.entityId}-${ops.length}`,
        at: now,
        direction: "notion_to_app",
        database: p.database,
        entityKind: kind,
        entityId: p.entityId,
        entityLabel: p.entityLabel,
        op: "update",
        fields: p.fields,
      });
    }
  }

  return ops;
}

/**
 * The NOTION → APP leg. These are the edits a volunteer could plausibly make
 * inside Notion that NEXUS must reflect locally after a sync/pull.
 */
export function buildPulled(data: NexusData) {
  const out: { database: string; entityId: string; entityLabel: string; fields: string[] }[] = [];
  const liveTask = data.tasks.find((t) => t.status === "in_progress");
  if (liveTask) {
    out.push({ database: "Tasks", entityId: liveTask.id, entityLabel: liveTask.title, fields: ["Status → completed", "Progress → 100"] });
  }
  const blockedTask = data.tasks.find((t) => t.status === "blocked");
  if (blockedTask) out.push({ database: "Tasks", entityId: blockedTask.id, entityLabel: blockedTask.title, fields: ["Status → in_progress"] });
  const speaker = data.speakers.find((s) => s.arrivalStatus !== "confirmed");
  if (speaker) out.push({ database: "Sessions", entityId: speaker.id, entityLabel: `${speaker.name} arrival`, fields: ["Speaker arrival → confirmed"] });
  const standby = data.volunteers.find((v) => v.status === "standby");
  if (standby) out.push({ database: "Volunteers", entityId: standby.id, entityLabel: standby.name, fields: ["Status → assigned"] });
  return out;
}

export function statsSummary(sync: NotionSyncState) {
  return {
    records: sync.stats.recordsSynced,
    created: sync.stats.created,
    updated: sync.stats.updated,
    failed: sync.stats.failed,
    pending: sync.stats.pending,
  };
}