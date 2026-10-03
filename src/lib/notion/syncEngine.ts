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
import type { PushRowResult } from "./client";
import type { AppliedRead } from "./readTransform";

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
  /**
   * True when the counts come from a deterministic simulation because no real
   * Notion credentials are configured. The Sync Center uses this to refuse to
   * show a success state and instead display "NOTION NOT CONNECTED".
   */
  simulated: boolean;
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
  simulated = true,
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
  // Without real credentials we record NO write operations and pull NO edits —
  // nothing may be presented as if it happened in Notion.
  const ops = simulated ? [] : buildOps(data, memory, prev, direction, now);
  const pulled = simulated ? [] : direction === "pull" || direction === "both" ? buildPulled(data) : [];

  const log: SyncLogEntry[] = [
    simulated
      ? {
          id: `log-${now}`,
          at: now,
          level: "warn" as const,
          message: `NOTION NOT CONNECTED — no records were sent to Notion. ${stats.recordsSynced} record(s) previewed locally only.`,
        }
      : {
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
      status: simulated ? "offline" : stats.failed > 0 ? "error" : "success",
      health,
      lastSyncAt: simulated ? null : now,
      stats,
      databases,
      recentOps: [...ops, ...prev.recentOps].slice(0, 60),
      log,
      error: simulated
        ? "NOTION NOT CONNECTED — no credentials configured. Nothing was synchronized."
        : stats.failed > 0
          ? `${stats.failed} record(s) failed to write. Local operational state is preserved.`
          : null,
    },
    ops,
    pulled,
    simulated,
  };
}

function findDb(key: string) {
  return NOTION_DATABASES.find((d) => d.key === key)!;
}

/**
 * Build the honest sync state from a REAL Notion operation.
 * `pushResults` / `pulled` come from the server proxy; nothing here is invented.
 * When `mock` is true the server ran the deterministic demo transport, so the
 * state is labelled accordingly and never presented as live synchronization.
 */
export function buildRealSync(
  prev: NotionSyncState,
  opts: {
    pushResults?: PushRowResult[];
    pulled?: { database: string; entityId: string; entityLabel: string; fields: string[] }[];
    syncedAt: string;
    mock: boolean;
    error?: string;
  },
): SyncOutcome {
  const byKey = new Map<string, { rows: number; synced: number; failed: number }>();
  for (const r of opts.pushResults ?? []) {
    const cur = byKey.get(r.key) ?? { rows: 0, synced: 0, failed: 0 };
    cur.rows += 1;
    if (r.status === "failed") cur.failed += 1;
    else cur.synced += 1;
    byKey.set(r.key, cur);
  }

  const databases: DatabaseSyncState[] = NOTION_DATABASES.map((d) => {
    const agg = byKey.get(d.key);
    return {
      id: d.key,
      name: d.name,
      icon: d.icon,
      mappedEntity: d.mappedEntity,
      rows: agg?.rows ?? 0,
      synced: agg?.synced ?? 0,
      failed: agg?.failed ?? 0,
      lastSyncedAt: agg ? opts.syncedAt : null,
    };
  });

  const ops: SyncOp[] = [];
  for (const r of opts.pushResults ?? []) {
    ops.push({
      id: `op-${r.key}-${r.entityId}-${ops.length}`,
      at: opts.syncedAt,
      direction: "app_to_notion",
      database: r.database,
      entityKind: (findDb(r.key)?.mappedEntity ?? "task") as SyncOp["entityKind"],
      entityId: r.entityId,
      entityLabel: r.entityId,
      op: r.status === "created" ? "create" : r.status === "updated" ? "update" : "conflict",
      fields: r.pageId ? [`page:${r.pageId.slice(0, 8)}`] : [],
    });
  }
  for (const p of opts.pulled ?? []) {
    ops.push({
      id: `op-pull-${p.entityId}-${ops.length}`,
      at: opts.syncedAt,
      direction: "notion_to_app",
      database: p.database,
      entityKind: "task",
      entityId: p.entityId,
      entityLabel: p.entityLabel ?? p.entityId,
      op: "update",
      fields: p.fields,
    });
  }

  const created = (opts.pushResults ?? []).filter((r) => r.status === "created").length;
  const updated = (opts.pushResults ?? []).filter((r) => r.status === "updated").length;
  const failed = (opts.pushResults ?? []).filter((r) => r.status === "failed").length;
  const recordsSynced = created + updated;

  const log: SyncLogEntry[] = [
    {
      id: `log-${opts.syncedAt}`,
      at: opts.syncedAt,
      level: (failed > 0 ? "warn" : "info") as SyncLogEntry["level"],
      message: opts.mock
        ? `DEMO NOTION MODE — ${created} created · ${updated} updated via the local mock transport (no real workspace was written).`
        : `Sync completed · ${created} created · ${updated} updated${failed ? ` · ${failed} failed` : ""}.`,
    },
    ...(opts.pulled?.length
      ? [
          {
            id: `log-${opts.syncedAt}-pull`,
            at: opts.syncedAt,
            level: "info" as const,
            message: `${opts.pulled.length} change(s) pulled from Notion → app state reconciled.`,
          },
        ]
      : []),
    ...prev.log,
  ].slice(0, 24);

  return {
    sync: {
      status: opts.error ? "error" : "success",
      health: failed > 0 || opts.error ? "warning" : "healthy",
      lastSyncAt: opts.syncedAt,
      stats: { created, updated, failed, pending: 0, recordsSynced },
      databases,
      recentOps: [...ops, ...prev.recentOps].slice(0, 60),
      log,
      error: opts.error ?? (failed > 0 ? `${failed} record(s) failed to write. Local operational state is preserved.` : null),
    },
    ops,
    pulled: opts.pulled ?? [],
    simulated: opts.mock,
  };
}

/** Convert applied Notion reads into the `pulled` shape the store reconciles. */
export function appliedReadsToPulled(applied: AppliedRead[]): SyncOutcome["pulled"] {
  return applied.map((a) => ({ database: a.database, entityId: a.entityId, entityLabel: a.entityLabel, fields: a.fields }));
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