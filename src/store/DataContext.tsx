import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type {
  ActivityEvent,
  ChangeRequest,
  CopilotMessage,
  DataSourceMeta,
  DependencyGraph,
  EventReport,
  Incident,
  IncidentStatus,
  MemoryEntry,
  NexusData,
  NotionConnection,
  NotionMode,
  NotionSyncState,
  RoleId,
  SimulationResult,
  Task,
  TaskStatus,
} from "@/types";
import { seedData, CURRENT_USER_ID } from "@/data/seed";
import { applyChange } from "@/lib/changeSimulator";
import { buildDependencyGraph } from "@/lib/dependencyEngine";
import { analyzeRisk, type RiskReport } from "@/lib/riskEngine";
import { allMemories, seedMemory } from "@/lib/memory";
import { generateEventReport } from "@/lib/reportGenerator";
import { initialSyncState, runDemoSync, type SyncOutcome } from "@/lib/notion/syncEngine";
import { getNotionStatus, pullFromNotion, pushToNotion } from "@/lib/notion/client";
import { mapDataToRows } from "@/lib/notion/mapping";

/* ------------------------------- types -------------------------------- */

export interface ServerStatus {
  available: boolean;
  reason?: string;
  workspaceName?: string;
  botName?: string;
  checkedAt: string | null;
}

type Action =
  | { type: "task/status"; id: string; status: TaskStatus }
  | { type: "task/progress"; id: string; progress: number }
  | { type: "task/create"; task: Task }
  | { type: "alert/ack"; id: string }
  | { type: "alert/ackAll" }
  | { type: "incident/create"; incident: Incident }
  | { type: "incident/status"; id: string; status: IncidentStatus }
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
  | { type: "demo/reset" };

interface State {
  data: NexusData;
  currentUserId: string;
  copilot: CopilotMessage[];
  role: RoleId;
  connection: NotionConnection;
  sync: NotionSyncState;
  memory: MemoryEntry[];
  report: EventReport | null;
  serverStatus: ServerStatus;
}

const initialConnection = (): NotionConnection => ({
  step: 1,
  completed: false,
  mode: "demo",
  workspaceName: seedData.notion.workspaceName,
  workspaceIcon: "◻️",
  parentPageId: "",
  parentPageName: "",
  selectedDatabaseIds: [],
  serverAvailable: false,
  checking: false,
  lastCheckedAt: null,
});

const initialState: State = {
  data: seedData,
  currentUserId: CURRENT_USER_ID,
  copilot: [],
  role: "organizer",
  connection: initialConnection(),
  sync: initialSyncState(),
  memory: seedMemory(seedData),
  report: null,
  serverStatus: { available: false, checkedAt: null },
};

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const nowIso = () => new Date().toISOString();

function nextProgress(status: TaskStatus, progress: number): number {
  if (status === "completed") return 100;
  if (status === "not_started") return Math.min(progress, 10);
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
  switch (action.type) {
    case "task/status": {
      const tasks = state.data.tasks.map((t) =>
        t.id === action.id ? { ...t, status: action.status, progress: nextProgress(action.status, t.progress) } : t,
      );
      return { ...state, data: { ...state.data, tasks } };
    }
    case "task/progress": {
      const tasks = state.data.tasks.map((t) => (t.id === action.id ? { ...t, progress: action.progress } : t));
      return { ...state, data: { ...state.data, tasks } };
    }
    case "task/create":
      return { ...state, data: { ...state.data, tasks: [action.task, ...state.data.tasks] } };
    case "alert/ack": {
      const alerts = state.data.alerts.map((a) => (a.id === action.id ? { ...a, acknowledged: true } : a));
      return { ...state, data: { ...state.data, alerts } };
    }
    case "alert/ackAll": {
      const alerts = state.data.alerts.map((a) => ({ ...a, acknowledged: true }));
      return { ...state, data: { ...state.data, alerts } };
    }
    case "incident/create":
      return { ...state, data: { ...state.data, incidents: [action.incident, ...state.data.incidents] } };
    case "incident/status": {
      const incidents = state.data.incidents.map((i) => (i.id === action.id ? { ...i, status: action.status } : i));
      return { ...state, data: { ...state.data, incidents } };
    }
    case "activity/push":
      return { ...state, data: { ...state.data, activity: [action.event, ...state.data.activity] } };
    case "change/apply": {
      const nextData = applyChange(state.data, action.request);
      return { ...state, data: { ...nextData, activity: [...action.activity, ...state.data.activity] } };
    }
    case "change/applyMany": {
      let next = state.data;
      for (const r of action.requests) next = applyChange(next, r);
      return { ...state, data: { ...next, activity: [...action.activity, ...state.data.activity] } };
    }
    case "volunteer/assign": {
      const volunteers = state.data.volunteers.map((v) =>
        v.id === action.volunteerId ? { ...v, status: "assigned" as const, workload: Math.min(100, v.workload + 12) } : v,
      );
      return { ...state, data: { ...state.data, volunteers, activity: [action.activity, ...state.data.activity] } };
    }
    case "volunteer/move": {
      const volunteers = state.data.volunteers.map((v) => (v.id === action.volunteerId ? { ...v, teamId: action.toTeamId } : v));
      return { ...state, data: { ...state.data, volunteers, activity: [action.activity, ...state.data.activity] } };
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
    case "notion/syncDone":
      return { ...state, data: reconcile(state.data, action.outcome.pulled), sync: action.outcome.sync };
    case "notion/syncFail":
      return { ...state, sync: { ...state.sync, status: "error", error: action.error } };
    case "memory/add":
      return { ...state, memory: [action.entry, ...state.memory] };
    case "report/set":
      return { ...state, report: action.report };
    case "demo/reset":
      return { ...initialState, data: structuredClone(seedData), memory: seedMemory(seedData) };
    default:
      return state;
  }
}

interface DataContextValue extends State {
  /** Shared intelligence artefacts, recomputed only when the dataset changes. */
  graph: DependencyGraph;
  risk: RiskReport;
  /** Curated + derived knowledge memories. */
  memories: MemoryEntry[];
  /** Whether the active dataset is demo or live Notion data. */
  dataSource: DataSourceMeta;

  setTaskStatus: (id: string, status: TaskStatus) => void;
  setTaskProgress: (id: string, progress: number) => void;
  taskById: (id: string) => Task | undefined;
  createTask: (task: Omit<Task, "id">) => Task;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAll: () => void;
  pushActivity: (event: Omit<ActivityEvent, "id" | "at">) => void;
  createIncident: (incident: Omit<Incident, "id" | "timestamp">) => void;
  setIncidentStatus: (id: string, status: IncidentStatus) => void;
  applySimulation: (result: SimulationResult) => void;
  applyChangeRequests: (requests: ChangeRequest[], label: string) => void;
  assignVolunteer: (volunteerId: string, note: string) => void;
  moveVolunteer: (volunteerId: string, toTeamId: string, reason: string) => void;

  setRole: (role: RoleId) => void;
  patchConnection: (patch: Partial<NotionConnection>) => void;
  connectNotion: (mode: NotionMode) => void;
  disconnectNotion: () => void;
  refreshServerStatus: () => Promise<ServerStatus>;
  syncNotion: (direction?: "both" | "push" | "pull") => Promise<SyncOutcome>;
  registerMemory: (entry: Omit<MemoryEntry, "id" | "capturedAt">) => void;
  generateReport: () => EventReport;
  resetDemo: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const graph = useMemo(() => buildDependencyGraph(state.data), [state.data]);
  const risk = useMemo(() => analyzeRisk(state.data), [state.data]);
  const memories = useMemo(() => allMemories(state.data, state.memory), [state.data, state.memory]);

  const value = useMemo<DataContextValue>(() => {
    const dataSource: DataSourceMeta =
      state.connection.mode === "live" && state.connection.serverAvailable
        ? { kind: "live", label: "LIVE NOTION DATA", detail: `${state.connection.workspaceName} · server proxy verified` }
        : { kind: "demo", label: "DEMO DATA", detail: "Synthetic dataset — no live Notion synchronization claimed" };

    return {
      ...state,
      graph,
      risk,
      memories,
      dataSource,
      setTaskStatus: (id, status) => dispatch({ type: "task/status", id, status }),
      setTaskProgress: (id, progress) => dispatch({ type: "task/progress", id, progress }),
      taskById: (id) => state.data.tasks.find((t) => t.id === id),
      createTask: (task) => {
        const created: Task = { ...task, id: uid("task") };
        dispatch({ type: "task/create", task: created });
        dispatch({
          type: "activity/push",
          event: {
            id: uid("act"),
            at: nowIso(),
            kind: "change",
            title: `Task created: ${created.title}`,
            detail: `Owned by ${created.department} · ${created.priority} priority`,
            actor: "Aisha Khan",
            related: [{ kind: "task", id: created.id, label: created.title }],
          },
        });
        return created;
      },
      acknowledgeAlert: (id) => dispatch({ type: "alert/ack", id }),
      acknowledgeAll: () => dispatch({ type: "alert/ackAll" }),
      pushActivity: (event) => dispatch({ type: "activity/push", event: { ...event, id: uid("act"), at: nowIso() } }),
      createIncident: (incident) => dispatch({ type: "incident/create", incident: { ...incident, id: uid("inc"), timestamp: nowIso() } }),
      setIncidentStatus: (id, status) => dispatch({ type: "incident/status", id, status }),

      applySimulation: (result) => {
        const activity: ActivityEvent[] = [
          { id: uid("act"), at: nowIso(), kind: "approval", title: `Change approved: ${result.request.subjectLabel}`, detail: `${result.request.fromValue} → ${result.request.toValue}`, actor: "Aisha Khan", related: [{ kind: result.request.subjectKind, id: result.request.subjectId, label: result.request.subjectLabel }] },
          { id: uid("act"), at: nowIso(), kind: "impact", title: `Impact analysis completed · score ${result.analysis.impactScore}/100`, detail: `${result.analysis.totalAffected} downstream items evaluated`, actor: "NEXUS Impact Engine", related: result.analysis.sourceRecords.slice(0, 4) },
          { id: uid("act"), at: nowIso(), kind: "detection", title: `${result.risks.length} risk conditions detected`, detail: result.risks[0]?.title ?? "No material risk surfaced", actor: "NEXUS Risk Engine", related: result.risks.flatMap((r) => r.related).slice(0, 4) },
          { id: uid("act"), at: nowIso(), kind: "recommendation", title: `${result.actions.length} recommended actions queued`, detail: result.actions[0]?.title ?? "Review with department lead", actor: "NEXUS Recommendation Engine", related: result.actions.flatMap((a) => a.related).slice(0, 4) },
          { id: uid("act"), at: nowIso(), kind: "sync", title: "Notion synchronisation queued", detail: "Affected records will be written back on next sync", actor: "NEXUS Sync", related: [] },
        ];
        dispatch({ type: "change/apply", request: result.request, activity });
      },
      applyChangeRequests: (requests, label) => {
        if (!requests.length) return;
        const activity: ActivityEvent[] = [
          { id: uid("act"), at: nowIso(), kind: "approval", title: `Change approved: ${label}`, detail: `${requests.length} record${requests.length === 1 ? "" : "s"} updated`, actor: "Aisha Khan", related: requests.map((r) => ({ kind: r.subjectKind, id: r.subjectId, label: r.subjectLabel })).slice(0, 4) },
          { id: uid("act"), at: nowIso(), kind: "sync", title: "Notion synchronisation queued", detail: "Affected records will be written back on next sync", actor: "NEXUS Sync", related: [] },
        ];
        dispatch({ type: "change/applyMany", requests, activity });
      },
      assignVolunteer: (volunteerId, note) =>
        dispatch({
          type: "volunteer/assign",
          volunteerId,
          activity: { id: uid("act"), at: nowIso(), kind: "approval", title: note, detail: "Assignment confirmed by the operations lead", actor: "Aisha Khan", related: [{ kind: "volunteer", id: volunteerId, label: state.data.volunteers.find((v) => v.id === volunteerId)?.name ?? volunteerId }] },
        }),
      moveVolunteer: (volunteerId, toTeamId, reason) =>
        dispatch({
          type: "volunteer/move",
          volunteerId,
          toTeamId,
          activity: { id: uid("act"), at: nowIso(), kind: "recommendation", title: `Workload rebalanced: ${state.data.volunteers.find((v) => v.id === volunteerId)?.name ?? volunteerId}`, detail: reason, actor: "NEXUS Workload Analyzer", related: [{ kind: "team", id: toTeamId, label: state.data.teams.find((t) => t.id === toTeamId)?.name ?? toTeamId }] },
        }),
      setRole: (role) => dispatch({ type: "role/set", role }),
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
              : state.data.notionDatabases.map((d) => d.id),
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
          workspaceName: status.workspaceName,
          botName: status.botName,
          checkedAt: status.checkedAt,
        };
        dispatch({ type: "notion/serverStatus", status: mapped });
        dispatch({ type: "notion/connection", patch: { checking: false, lastCheckedAt: status.checkedAt } });
        return mapped;
      },
      syncNotion: async (direction = "both") => {
        dispatch({ type: "notion/syncStart" });
        const live = state.connection.mode === "live" && state.connection.serverAvailable;
        let breach = false;
        try {
          if (live) {
            if (direction !== "pull") {
              const pushed = await pushToNotion(mapDataToRows(state.data, memories));
              if (!pushed.ok || (pushed.created === 0 && pushed.updated === 0 && pushed.failed === 0)) breach = true;
            }
            if (direction !== "push") await pullFromNotion();
          }
          // Demo mode is a deterministic simulation, clearly labelled DEMO DATA.
        } catch (err) {
          breach = true;
          dispatch({
            type: "notion/syncFail",
            error: err instanceof Error ? err.message : "Notion connection temporarily unavailable.",
          });
        }
        const outcome = runDemoSync(state.data, memories, state.sync, direction, breach);
        dispatch({ type: "notion/syncDone", outcome });
        if (breach) {
          dispatch({
            type: "notion/serverStatus",
            status: {
              available: false,
              reason: "Notion connection temporarily unavailable. Local operational state is preserved.",
              checkedAt: new Date().toISOString(),
            },
          });
        }
        return outcome;
      },
      registerMemory: (entry) => dispatch({ type: "memory/add", entry: { ...entry, id: uid("mem"), capturedAt: nowIso() } }),
      generateReport: () => {
        const report = generateEventReport(state.data, memories);
        dispatch({ type: "report/set", report });
        return report;
      },
      resetDemo: () => dispatch({ type: "demo/reset" }),
    };
  }, [state, graph, risk, memories]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useNexus(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useNexus must be used within DataProvider");
  return ctx;
}

