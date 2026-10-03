import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type {
  ActivityEvent,
  ChangeRequest,
  Communication,
  CopilotMessage,
  DataSourceMeta,
  Dependency,
  DependencyGraph,
  EntityKind,
  EventRecord,
  EventReport,
  Incident,
  IncidentStatus,
  KnowledgeItem,
  Member,
  MemoryEntry,
  NexusData,
  Participant,
  NotionConnection,
  NotionMode,
  NotionSyncState,
  NotionTrace,
  RecordSource,
  ResourceItem,
  RoleId,
  Session,
  SimulationResult,
  Speaker,
  Task,
  TaskStatus,
  Team,
  Venue,
  Volunteer,
  WorkspaceMode,
} from "@/types";
import { seedData, CURRENT_USER_ID } from "@/data/seed";
import { applyChange } from "@/lib/changeSimulator";
import { buildDependencyGraph } from "@/lib/dependencyEngine";
import { analyzeRisk, type RiskReport } from "@/lib/riskEngine";
import { allMemories, seedMemory } from "@/lib/memory";
import { generateEventReport } from "@/lib/reportGenerator";
import { appliedReadsToPulled, buildRealSync, initialSyncState, runDemoSync, type SyncOutcome } from "@/lib/notion/syncEngine";
import { getNotionStatus, pullFromNotion, pushToNotion, readFromNotion } from "@/lib/notion/client";
import { mapDataToRows } from "@/lib/notion/mapping";
import { applyNotionRead, attachNotionTraces } from "@/lib/notion/readTransform";
import {
  createEmptyLiveData,
  clearPersistedLiveData,
  loadLiveData,
  loadWorkspaceMode,
  saveLiveData,
  saveWorkspaceMode,
  tagDemoData,
} from "@/lib/workspace";

/* ------------------------------- types -------------------------------- */

export interface ServerStatus {
  available: boolean;
  reason?: string;
  action?: string;
  workspaceName?: string;
  botName?: string;
  /** "live" (real token) | "mock" (demo transport) | "offline" */
  mode?: "live" | "mock" | "offline";
  checkedAt: string | null;
}

/** Collections that can be created / updated / deleted through the store. */
export type CollectionKey =
  | "venues"
  | "speakers"
  | "sessions"
  | "teams"
  | "members"
  | "volunteers"
  | "participants"
  | "tasks"
  | "resources"
  | "dependencies"
  | "communications"
  | "knowledge"
  | "incidents";

interface EntityMap {
  venues: Venue;
  speakers: Speaker;
  sessions: Session;
  teams: Team;
  members: Member;
  volunteers: Volunteer;
  participants: Participant;
  tasks: Task;
  resources: ResourceItem;
  dependencies: Dependency;
  communications: Communication;
  knowledge: KnowledgeItem;
  incidents: Incident;
}

type Action =
  | { type: "mode/set"; mode: WorkspaceMode }
  | { type: "task/status"; id: string; status: TaskStatus }
  | { type: "task/progress"; id: string; progress: number }
  | { type: "task/create"; task: Task }
  | { type: "alert/ack"; id: string }
  | { type: "alert/ackAll" }
  | { type: "incident/create"; incident: Incident }
  | { type: "incident/status"; id: string; status: IncidentStatus }
  | { type: "incident/notion"; id: string; notion: NotionTrace }
  | { type: "memory/notion"; id: string; pageId: string; at: string }
  | { type: "activity/push"; event: ActivityEvent }
  | { type: "change/apply"; request: ChangeRequest; activity: ActivityEvent[] }
  | { type: "change/applyMany"; requests: ChangeRequest[]; activity: ActivityEvent[] }
  | { type: "volunteer/assign"; volunteerId: string; activity: ActivityEvent }
  | { type: "volunteer/move"; volunteerId: string; toTeamId: string; activity: ActivityEvent }
  | { type: "role/set"; role: RoleId }
  | { type: "notion/connection"; patch: Partial<NotionConnection> }
  | { type: "notion/serverStatus"; status: ServerStatus }
  | { type: "notion/syncStart" }
  | { type: "notion/syncDone"; outcome: SyncOutcome }
  | { type: "notion/syncFail"; error: string }
  | { type: "memory/add"; entry: MemoryEntry }
  | { type: "report/set"; report: EventReport }
  | { type: "event/update"; patch: Partial<EventRecord> }
  | { type: "entity/create"; collection: CollectionKey; record: { id: string } }
  | { type: "entity/update"; collection: CollectionKey; id: string; patch: Record<string, unknown> }
  | { type: "entity/delete"; collection: CollectionKey; id: string }
  | { type: "data/replace"; data: NexusData }
  | { type: "demo/reset" }
  | { type: "live/reset" }
  | { type: "demo/start" }
  | { type: "demo/close" }
  | { type: "demo/step"; step: number }
  | { type: "demo/emergency"; open: boolean };

interface State {
  mode: WorkspaceMode;
  demoData: NexusData;
  liveData: NexusData;
  currentUserId: string;
  copilot: CopilotMessage[];
  role: RoleId;
  connection: NotionConnection;
  sync: NotionSyncState;
  demoMemory: MemoryEntry[];
  liveMemory: MemoryEntry[];
  report: EventReport | null;
  serverStatus: ServerStatus;
  /** Guided demo walkthrough state (KBC-NOTION-03 live demo). */
  demoActive: boolean;
  demoStep: number;
  emergencyOpen: boolean;
}

const initialConnection = (): NotionConnection => ({
  step: 1,
  completed: false,
  mode: "demo",
  workspaceName: "Notion (not connected)",
  workspaceIcon: "◻️",
  parentPageId: "",
  parentPageName: "",
  selectedDatabaseIds: [],
  serverAvailable: false,
  checking: false,
  lastCheckedAt: null,
});

const initialState: State = {
  mode: loadWorkspaceMode(),
  demoData: tagDemoData(seedData),
  liveData: loadLiveData(),
  currentUserId: CURRENT_USER_ID,
  copilot: [],
  role: "organizer",
  connection: initialConnection(),
  sync: initialSyncState(),
  demoMemory: seedMemory(seedData),
  liveMemory: [],
  report: null,
  serverStatus: { available: false, checkedAt: null },
};

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const nowIso = () => new Date().toISOString();

/** The active dataset for a given mode. */
const activeData = (state: State): NexusData => (state.mode === "demo" ? state.demoData : state.liveData);

/** Replace the active dataset, leaving the other workspace untouched. */
function setActiveData(state: State, data: NexusData): State {
  return state.mode === "demo" ? { ...state, demoData: data } : { ...state, liveData: data };
}

function nextProgress(status: TaskStatus, progress: number): number {
  if (status === "completed") return 100;
  if (status === "not_started") return Math.min(progress, 10);
  if (status === "at_risk") return Math.min(progress, 95);
  return progress;
}

/**
 * NOTION → APP reconciliation: apply the edits reported by a pull onto the local
 * operational dataset. This is what makes a change made inside Notion visibly
 * affect NEXUS after a sync/refresh.
 */
function reconcile(data: NexusData, pulled: SyncOutcome["pulled"]): NexusData {
  if (!pulled.length) return data;
  let next = data;
  for (const p of pulled) {
    const statusField = p.fields.find((f) => f.startsWith("Status → "));
    if (p.database === "Tasks" && statusField) {
      const status = statusField.replace("Status → ", "").replace(" ", "_") as TaskStatus;
      next = {
        ...next,
        tasks: next.tasks.map((t) => (t.id === p.entityId ? { ...t, status, progress: nextProgress(status, t.progress) } : t)),
      };
    }
    if (p.database === "Sessions" && p.fields.some((f) => f.includes("arrival"))) {
      next = {
        ...next,
        speakers: next.speakers.map((s) => (s.id === p.entityId ? { ...s, arrivalStatus: "confirmed", confirmed: true } : s)),
      };
    }
    if (p.database === "Volunteers" && p.fields.some((f) => f.includes("assigned"))) {
      next = {
        ...next,
        volunteers: next.volunteers.map((v) => (v.id === p.entityId ? { ...v, status: "assigned" } : v)),
      };
    }
  }
  return next;
}

function reducer(state: State, action: Action): State {
  const data = activeData(state);
  switch (action.type) {
    case "mode/set":
      return { ...state, mode: action.mode, report: null };
    case "task/status": {
      const tasks = data.tasks.map((t) =>
        t.id === action.id ? { ...t, status: action.status, progress: nextProgress(action.status, t.progress) } : t,
      );
      return setActiveData(state, { ...data, tasks });
    }
    case "task/progress": {
      const tasks = data.tasks.map((t) => (t.id === action.id ? { ...t, progress: action.progress } : t));
      return setActiveData(state, { ...data, tasks });
    }
    case "task/create":
      return setActiveData(state, { ...data, tasks: [action.task, ...data.tasks] });
    case "alert/ack": {
      const alerts = data.alerts.map((a) => (a.id === action.id ? { ...a, acknowledged: true } : a));
      return setActiveData(state, { ...data, alerts });
    }
    case "alert/ackAll": {
      const alerts = data.alerts.map((a) => ({ ...a, acknowledged: true }));
      return setActiveData(state, { ...data, alerts });
    }
    case "incident/create":
      return setActiveData(state, { ...data, incidents: [action.incident, ...data.incidents] });
    case "incident/status": {
      const incidents = data.incidents.map((i) => (i.id === action.id ? { ...i, status: action.status } : i));
      return setActiveData(state, { ...data, incidents });
    }
    case "incident/notion": {
      const incidents = data.incidents.map((i) => (i.id === action.id ? { ...i, notion: action.notion } : i));
      return setActiveData(state, { ...data, incidents });
    }
    case "memory/notion": {
      const patch = (list: MemoryEntry[]) => list.map((m) => (m.id === action.id ? { ...m, notionPageId: action.pageId, notion: { notionPageId: action.pageId, lastSyncedAt: action.at, syncStatus: "synced" as const, source: "nexus" as const } } : m));
      return state.mode === "demo" ? { ...state, demoMemory: patch(state.demoMemory) } : { ...state, liveMemory: patch(state.liveMemory) };
    }
    case "activity/push":
      return setActiveData(state, { ...data, activity: [action.event, ...data.activity] });
    case "change/apply": {
      const nextData = applyChange(data, action.request);
      return setActiveData(state, { ...nextData, activity: [...action.activity, ...data.activity] });
    }
    case "change/applyMany": {
      let next = data;
      for (const r of action.requests) next = applyChange(next, r);
      return setActiveData(state, { ...next, activity: [...action.activity, ...data.activity] });
    }
    case "volunteer/assign": {
      const volunteers = data.volunteers.map((v) =>
        v.id === action.volunteerId ? { ...v, status: "assigned" as const, workload: Math.min(100, v.workload + 12) } : v,
      );
      return setActiveData(state, { ...data, volunteers, activity: [action.activity, ...data.activity] });
    }
    case "volunteer/move": {
      const volunteers = data.volunteers.map((v) => (v.id === action.volunteerId ? { ...v, teamId: action.toTeamId } : v));
      return setActiveData(state, { ...data, volunteers, activity: [action.activity, ...data.activity] });
    }
    case "role/set":
      return { ...state, role: action.role };
    case "notion/connection":
      return { ...state, connection: { ...state.connection, ...action.patch } };
    case "notion/serverStatus":
      return {
        ...state,
        serverStatus: action.status,
        connection: { ...state.connection, serverAvailable: action.status.available, lastCheckedAt: action.status.checkedAt },
      };
    case "notion/syncStart":
      return { ...state, sync: { ...state.sync, status: "syncing", error: null } };
    case "notion/syncDone": {
      const reconciled = reconcile(data, action.outcome.pulled);
      return { ...setActiveData(state, reconciled), sync: action.outcome.sync };
    }
    case "notion/syncFail":
      return { ...state, sync: { ...state.sync, status: "error", error: action.error } };
    case "memory/add":
      return state.mode === "demo"
        ? { ...state, demoMemory: [action.entry, ...state.demoMemory] }
        : { ...state, liveMemory: [action.entry, ...state.liveMemory] };
    case "report/set":
      return { ...state, report: action.report };
    case "event/update":
      return setActiveData(state, { ...data, event: { ...data.event, ...action.patch } });
    case "entity/create": {
      const list = data[action.collection] as { id: string }[];
      return setActiveData(state, { ...data, [action.collection]: [action.record, ...list] });
    }
    case "entity/update": {
      const list = data[action.collection] as { id: string }[];
      const updated = list.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r));
      return setActiveData(state, { ...data, [action.collection]: updated });
    }
    case "entity/delete": {
      const list = data[action.collection] as { id: string }[];
      const filtered = list.filter((r) => r.id !== action.id);
      return setActiveData(state, { ...data, [action.collection]: filtered });
    }
    case "data/replace":
      return setActiveData(state, action.data);
    case "demo/reset":
      return { ...state, demoData: tagDemoData(structuredClone(seedData)), demoMemory: seedMemory(seedData) };
    case "live/reset":
      return { ...state, liveData: createEmptyLiveData(), liveMemory: [] };
    default:
      return state;
  }
}

/* ----------------------------- context -------------------------------- */

interface DataContextValue extends Omit<State, "demoData" | "liveData" | "demoMemory" | "liveMemory"> {
  /** The active workspace dataset (demo OR live — never mixed). */
  data: NexusData;
  /** Shared intelligence artefacts, recomputed only when the dataset changes. */
  graph: DependencyGraph;
  risk: RiskReport;
  /** Curated + derived knowledge memories for the active workspace. */
  memories: MemoryEntry[];
  /** Whether the active dataset is demo or live data. */
  dataSource: DataSourceMeta;
  /** True when a real Notion token-backed connection is available. */
  notionConnected: boolean;
  /** Number of records in each workspace (for the mode switcher). */
  counts: { demo: number; live: number };

  setTaskStatus: (id: string, status: TaskStatus) => void;
  setTaskProgress: (id: string, progress: number) => void;
  taskById: (id: string) => Task | undefined;
  createTask: (task: Omit<Task, "id" | "sourceType">) => Task;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAll: () => void;
  pushActivity: (event: Omit<ActivityEvent, "id" | "at">) => void;
  createIncident: (incident: Omit<Incident, "id" | "timestamp" | "sourceType">) => void;
  setIncidentStatus: (id: string, status: IncidentStatus) => void;
  applySimulation: (result: SimulationResult) => void;
  applyChangeRequests: (requests: ChangeRequest[], label: string) => void;
  assignVolunteer: (volunteerId: string, note: string) => void;
  moveVolunteer: (volunteerId: string, toTeamId: string, reason: string) => void;

  setRole: (role: RoleId) => void;
  setMode: (mode: WorkspaceMode) => void;

  /** Create a real record in the active workspace; provenance is attached automatically. */
  createEntity: <K extends CollectionKey>(collection: K, record: Omit<EntityMap[K], "id" | "sourceType">) => EntityMap[K];
  updateEntity: <K extends CollectionKey>(collection: K, id: string, patch: Partial<EntityMap[K]>) => void;
  deleteEntity: (collection: CollectionKey, id: string) => void;
  updateEvent: (patch: Partial<EventRecord>) => void;
  /** Raise an escalation on a blocked/at-risk task (routes to the owning team's lead). */
  escalateTask: (id: string, reason: string) => void;

  patchConnection: (patch: Partial<NotionConnection>) => void;
  connectNotion: (mode: NotionMode) => void;
  disconnectNotion: () => void;
  refreshServerStatus: () => Promise<ServerStatus>;
  syncNotion: (direction?: "both" | "push" | "pull") => Promise<SyncOutcome>;
  registerMemory: (entry: Omit<MemoryEntry, "id" | "capturedAt" | "sourceType">) => void;
  generateReport: () => EventReport;
  /** Restores the synthetic demo dataset. NEVER touches live data. */
  resetDemo: () => void;
  /** Wipes the LIVE workspace. Guarded behind an explicit confirmation in the UI. */
  resetLive: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const DATA_COLLECTIONS: CollectionKey[] = [
  "venues",
  "speakers",
  "sessions",
  "teams",
  "members",
  "volunteers",
  "participants",
  "tasks",
  "resources",
  "dependencies",
  "communications",
  "knowledge",
  "incidents",
];

function recordCount(data: NexusData): number {
  return DATA_COLLECTIONS.reduce((n, key) => n + (data[key] as unknown[]).length, 0);
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const data = activeData(state);
  const memory = state.mode === "demo" ? state.demoMemory : state.liveMemory;

  const graph = useMemo(() => buildDependencyGraph(data), [data]);
  const risk = useMemo(() => analyzeRisk(data), [data]);
  const memories = useMemo(() => allMemories(data, memory), [data, memory]);

  // Persist the live workspace and the chosen mode whenever they change.
  useEffect(() => {
    if (state.mode === "live") saveLiveData(state.liveData);
  }, [state.liveData, state.mode]);
  useEffect(() => {
    saveWorkspaceMode(state.mode);
  }, [state.mode]);

  const counts = useMemo(
    () => ({ demo: recordCount(state.demoData), live: recordCount(state.liveData) }),
    [state.demoData, state.liveData],
  );

  const value = useMemo<DataContextValue>(() => {
    const notionConnected = state.connection.mode === "live" && state.connection.serverAvailable;
    const dataSource: DataSourceMeta =
      state.mode === "demo"
        ? { kind: "demo", label: "DEMO DATA", detail: "Synthetic dataset — no live Notion synchronization claimed" }
        : notionConnected
          ? { kind: "live", label: "LIVE DATA · NOTION CONNECTED", detail: `${state.connection.workspaceName} · real push/pull enabled` }
          : { kind: "live", label: "LIVE DATA", detail: "Real operational data stored on this device · Notion not connected" };

    const sourceForMode: RecordSource = state.mode === "demo" ? "demo" : "live";
    const activity = (kind: ActivityEvent["kind"], title: string, detail?: string, related?: ActivityEvent["related"]): ActivityEvent => ({
      id: uid("act"),
      at: nowIso(),
      kind,
      title,
      detail,
      actor: "Aisha Khan",
      related,
    });

    return {
      ...state,
      data,
      graph,
      risk,
      memories,
      dataSource,
      notionConnected,
      counts,
      setTaskStatus: (id, status) => dispatch({ type: "task/status", id, status }),
      setTaskProgress: (id, progress) => dispatch({ type: "task/progress", id, progress }),
      taskById: (id) => data.tasks.find((t) => t.id === id),
      createTask: (task) => {
        const created: Task = { ...task, id: uid("task"), sourceType: sourceForMode };
        dispatch({ type: "task/create", task: created });
        dispatch({
          type: "activity/push",
          event: activity("change", `Task created: ${created.title}`, `Owned by ${created.department} · ${created.priority} priority`, [
            { kind: "task", id: created.id, label: created.title },
          ]),
        });
        return created;
      },
      acknowledgeAlert: (id) => dispatch({ type: "alert/ack", id }),
      acknowledgeAll: () => dispatch({ type: "alert/ackAll" }),
      pushActivity: (event) => dispatch({ type: "activity/push", event: { ...event, id: uid("act"), at: nowIso() } }),
      createIncident: (incident) => {
        const created: Incident = { ...incident, id: uid("inc"), timestamp: nowIso(), sourceType: sourceForMode };
        dispatch({ type: "incident/create", incident: created });
        dispatch({
          type: "activity/push",
          event: activity("incident", `Incident opened: ${created.title}`, `${created.severity.toUpperCase()} · ${created.location}`, [
            { kind: "incident", id: created.id, label: created.title },
          ]),
        });
        // If Notion is genuinely connected, write the incident immediately and
        // attach the returned page id so the UI can show `Synced to Notion`.
        if (notionConnected) {
          void (async () => {
            try {
              const rows = mapDataToRows({ ...data, incidents: [created, ...data.incidents] }, memories);
              const pushed = await pushToNotion({ incidents: rows.incidents.slice(0, 1) });
              const result = pushed.results.find((r) => r.key === "incidents" && r.entityId === created.id);
              if (result && result.status !== "failed" && result.pageId) {
                dispatch({ type: "incident/notion", id: created.id, notion: { notionPageId: result.pageId, notionDatabaseId: result.databaseId, lastSyncedAt: pushed.syncedAt ?? nowIso(), syncStatus: "synced", source: "nexus" } });
                dispatch({ type: "activity/push", event: activity("sync", `Incident ${created.id} synced to Notion`, `page ${result.pageId.slice(0, 8)} · ${pushed.mock ? "DEMO transport" : "live API"}`, [{ kind: "incident", id: created.id, label: created.title }]) });
              } else {
                dispatch({ type: "incident/notion", id: created.id, notion: { syncStatus: "failed", source: "nexus" } });
              }
            } catch {
              dispatch({ type: "incident/notion", id: created.id, notion: { syncStatus: "failed", source: "nexus" } });
            }
          })();
        }
      },
      setIncidentStatus: (id, status) => dispatch({ type: "incident/status", id, status }),

      applySimulation: (result) => {
        const trace: ActivityEvent[] = [
          activity("approval", `Change approved: ${result.request.subjectLabel}`, `${result.request.fromValue} → ${result.request.toValue}`, [{ kind: result.request.subjectKind, id: result.request.subjectId, label: result.request.subjectLabel }]),
          activity("impact", `Impact analysis completed · score ${result.analysis.impactScore}/100`, `${result.analysis.totalAffected} downstream items evaluated`, result.analysis.sourceRecords.slice(0, 4)),
          activity("detection", `${result.risks.length} risk conditions detected`, result.risks[0]?.title ?? "No material risk surfaced", result.risks.flatMap((r) => r.related).slice(0, 4)),
          activity("recommendation", `${result.actions.length} recommended actions queued`, result.actions[0]?.title ?? "Review with department lead", result.actions.flatMap((a) => a.related).slice(0, 4)),
          activity("sync", "Notion synchronisation queued", "Affected records will be written back on next sync", []),
        ];
        dispatch({ type: "change/apply", request: result.request, activity: trace });
      },
      applyChangeRequests: (requests, label) => {
        if (!requests.length) return;
        const trace: ActivityEvent[] = [
          activity("approval", `Change approved: ${label}`, `${requests.length} record${requests.length === 1 ? "" : "s"} updated`, requests.map((r) => ({ kind: r.subjectKind, id: r.subjectId, label: r.subjectLabel })).slice(0, 4)),
          activity("sync", "Notion synchronisation queued", "Affected records will be written back on next sync", []),
        ];
        dispatch({ type: "change/applyMany", requests, activity: trace });
      },
      assignVolunteer: (volunteerId, note) =>
        dispatch({
          type: "volunteer/assign",
          volunteerId,
          activity: activity("approval", note, "Assignment confirmed by the operations lead", [{ kind: "volunteer", id: volunteerId, label: data.volunteers.find((v) => v.id === volunteerId)?.name ?? volunteerId }]),
        }),
      moveVolunteer: (volunteerId, toTeamId, reason) =>
        dispatch({
          type: "volunteer/move",
          volunteerId,
          toTeamId,
          activity: activity("recommendation", `Workload rebalanced: ${data.volunteers.find((v) => v.id === volunteerId)?.name ?? volunteerId}`, reason, [{ kind: "team", id: toTeamId, label: data.teams.find((t) => t.id === toTeamId)?.name ?? toTeamId }]),
        }),
      setRole: (role) => dispatch({ type: "role/set", role }),
      setMode: (mode) => dispatch({ type: "mode/set", mode }),

      createEntity: (collection, record) => {
        const created = { ...(record as object), id: uid(collection.slice(0, 4)), sourceType: sourceForMode } as EntityMap[typeof collection];
        dispatch({ type: "entity/create", collection, record: created });
        const label =
          (record as { name?: string }).name ??
          (record as { title?: string }).title ??
          (record as { subject?: string }).subject ??
          created.id;
        dispatch({
          type: "activity/push",
          event: activity("change", `Created ${collection.slice(0, -1)}: ${label}`, undefined, [
            { kind: collection.slice(0, -1) as EntityKind, id: created.id, label },
          ]),
        });
        return created;
      },
      updateEntity: (collection, id, patch) => dispatch({ type: "entity/update", collection, id, patch: patch as Record<string, unknown> }),
      deleteEntity: (collection, id) => dispatch({ type: "entity/delete", collection, id }),
      updateEvent: (patch) => dispatch({ type: "event/update", patch }),
      escalateTask: (id, reason) => {
        const task = data.tasks.find((t) => t.id === id);
        if (!task) return;
        const team = data.teams.find((t) => t.id === task.teamId);
        const escalatedTo = team?.leadMemberId ?? data.members[0]?.id ?? "";
        const target = data.members.find((m) => m.id === escalatedTo)?.name ?? escalatedTo;
        dispatch({
          type: "entity/update",
          collection: "tasks",
          id,
          patch: { status: "at_risk", escalation: { escalatedTo, reason, raisedAt: nowIso() } },
        });
        dispatch({
          type: "activity/push",
          event: activity("approval", `Task escalated: ${task.title}`, `${reason} · routed to ${target}`, [{ kind: "task", id: task.id, label: task.title }]),
        });
      },

      patchConnection: (patch) => dispatch({ type: "notion/connection", patch }),
      connectNotion: (mode) =>
        dispatch({
          type: "notion/connection",
          patch: {
            mode,
            completed: true,
            step: 5,
            selectedDatabaseIds: state.connection.selectedDatabaseIds.length
              ? state.connection.selectedDatabaseIds
              : data.notionDatabases.map((d) => d.id),
          },
        }),
      disconnectNotion: () =>
        dispatch({
          type: "notion/connection",
          patch: { mode: "demo", completed: false, step: 1, serverAvailable: false, selectedDatabaseIds: [] },
        }),

      refreshServerStatus: async () => {
        dispatch({ type: "notion/connection", patch: { checking: true } });
        const status = await getNotionStatus();
        const mapped: ServerStatus = {
          available: status.available,
          reason: status.reason,
          action: status.action,
          workspaceName: status.workspaceName,
          botName: status.botName,
          mode: status.mode,
          checkedAt: status.checkedAt,
        };
        dispatch({ type: "notion/serverStatus", status: mapped });
        // A real (or mock) connection may also complete the wizard.
        if (status.available) {
          dispatch({
            type: "notion/connection",
            patch: { checking: false, lastCheckedAt: status.checkedAt, serverAvailable: true, mode: status.mode === "live" ? "live" : "demo" },
          });
        } else {
          dispatch({ type: "notion/connection", patch: { checking: false, lastCheckedAt: status.checkedAt, serverAvailable: false } });
        }
        return mapped;
      },
      syncNotion: async (direction = "both") => {
        dispatch({ type: "notion/syncStart" });
        // `live` means a real OR mock connection is verified on the server. A
        // mock connection is honest about being a demo transport.
        const live = state.connection.mode === "live" && state.connection.serverAvailable;
        const mock = state.serverStatus.mode === "mock";
        const at = new Date().toISOString();

        if (!live) {
          // No credentials → NO real synchronization. The outcome is marked
          // simulated so the UI can never claim a fake success.
          const outcome = runDemoSync(data, memories, state.sync, direction, false, true);
          dispatch({ type: "notion/syncDone", outcome });
          dispatch({
            type: "notion/serverStatus",
            status: {
              available: false,
              mode: "offline",
              reason: "NOTION NOT CONNECTED — no credentials configured. No records were sent to Notion.",
              action: "Set NOTION_API_KEY (and NOTION_PARENT_PAGE_ID) on the server, or NEXUS_MOCK_NOTION=1 for demo mode.",
              checkedAt: at,
            },
          });
          return outcome;
        }

        try {
          let pushResults: Awaited<ReturnType<typeof pushToNotion>>["results"] = [];
          let pulled: SyncOutcome["pulled"] = [];

          if (direction !== "pull") {
            const pushed = await pushToNotion(mapDataToRows(data, memories));
            pushResults = pushed.results ?? [];
            // Attach the returned page ids to local records (traceability).
            const { data: traced, traced: count } = attachNotionTraces(data, pushResults, pushed.syncedAt ?? at);
            if (count > 0) dispatch({ type: "data/replace", data: traced });
            if (pushed.error) {
              dispatch({ type: "notion/syncFail", error: `${pushed.error.reason} ${pushed.error.action}` });
            }
          }

          if (direction !== "push") {
            // Real READ + reconcile: apply Notion-side edits onto local records.
            const read = await readFromNotion();
            if (read.ok) {
              const { data: reconciled, applied } = applyNotionRead(data, read.databases);
              pulled = appliedReadsToPulled(applied);
              if (applied.length) dispatch({ type: "data/replace", data: reconciled });
            }
            // Pull log (changes made inside Notion) supplements the read. If the
            // read already applied changes, keep both views consistent.
            const pulledLog = await pullFromNotion().catch(() => null);
            if (pulledLog?.ok && !pulled.length && pulledLog.updated.length) {
              pulled = pulledLog.updated.map((u) => ({ database: u.database, entityId: u.entityId, entityLabel: u.entityId, fields: u.fields }));
            }
          }

          const outcome = buildRealSync(state.sync, { pushResults, pulled, syncedAt: at, mock });
          dispatch({ type: "notion/syncDone", outcome });
          return outcome;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Notion connection temporarily unavailable.";
          dispatch({ type: "notion/syncFail", error: message });
          const outcome = runDemoSync(data, memories, state.sync, direction, true, true);
          dispatch({ type: "notion/syncDone", outcome });
          return outcome;
        }
      },
      registerMemory: (entry) => {
        const created: MemoryEntry = { ...entry, id: uid("mem"), capturedAt: nowIso(), sourceType: sourceForMode };
        dispatch({ type: "memory/add", entry: created });
        if (notionConnected) {
          void (async () => {
            try {
              const rows = mapDataToRows(data, [created, ...memories]);
              const pushed = await pushToNotion({ knowledge: rows.knowledge.slice(0, 1) });
              const result = pushed.results.find((r) => r.key === "knowledge" && r.entityId === created.id);
              if (result && result.status !== "failed" && result.pageId) {
                dispatch({ type: "memory/notion", id: created.id, pageId: result.pageId, at: pushed.syncedAt ?? nowIso() });
                dispatch({ type: "activity/push", event: activity("sync", `Knowledge record synced to Notion`, `page ${result.pageId.slice(0, 8)} · ${pushed.mock ? "DEMO transport" : "live API"}`, [{ kind: "knowledge", id: created.id, label: created.title }]) });
              }
            } catch {
              /* memory stays local; sync is retried on the next full sync */
            }
          })();
        }
      },
      generateReport: () => {
        const report = generateEventReport(data, memories);
        dispatch({ type: "report/set", report });
        return report;
      },
      resetDemo: () => dispatch({ type: "demo/reset" }),
      resetLive: () => {
        clearPersistedLiveData();
        dispatch({ type: "live/reset" });
      },
    };
  }, [state, data, graph, risk, memories, counts]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useNexus(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useNexus must be used within DataProvider");
  return ctx;
}
