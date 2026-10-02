import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type {
  ActivityEvent,
  ChangeRequest,
  CopilotMessage,
  DependencyGraph,
  Incident,
  IncidentStatus,
  NexusData,
  NotionMode,
  SimulationResult,
  Task,
  TaskStatus,
} from "@/types";
import { seedData, CURRENT_USER_ID } from "@/data/seed";
import { applyChange } from "@/lib/changeSimulator";
import { buildDependencyGraph } from "@/lib/dependencyEngine";
import { analyzeRisk, type RiskReport } from "@/lib/riskEngine";

type Action =
  | { type: "task/status"; id: string; status: TaskStatus }
  | { type: "task/progress"; id: string; progress: number }
  | { type: "alert/ack"; id: string }
  | { type: "alert/ackAll" }
  | { type: "notion/connect"; mode: NotionMode }
  | { type: "notion/disconnect" }
  | { type: "notion/syncing"; syncing: boolean }
  | { type: "notion/synced" }
  | { type: "activity/push"; event: ActivityEvent }
  | { type: "incident/create"; incident: Incident }
  | { type: "incident/status"; id: string; status: IncidentStatus }
  | { type: "change/apply"; request: ChangeRequest; activity: ActivityEvent[] }
  | { type: "volunteer/assign"; volunteerId: string; activity: ActivityEvent }
  | { type: "volunteer/move"; volunteerId: string; toTeamId: string; activity: ActivityEvent };

interface State {
  data: NexusData;
  currentUserId: string;
  copilot: CopilotMessage[];
}

function nextProgress(status: TaskStatus, progress: number): number {
  if (status === "completed") return 100;
  if (status === "not_started") return Math.min(progress, 10);
  return progress;
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
    case "alert/ack": {
      const alerts = state.data.alerts.map((a) => (a.id === action.id ? { ...a, acknowledged: true } : a));
      return { ...state, data: { ...state.data, alerts } };
    }
    case "alert/ackAll": {
      const alerts = state.data.alerts.map((a) => ({ ...a, acknowledged: true }));
      return { ...state, data: { ...state.data, alerts } };
    }
    case "notion/connect":
      return {
        ...state,
        data: {
          ...state.data,
          notion: { ...state.data.notion, connected: true, mode: action.mode, hasToken: action.mode === "live" },
        },
      };
    case "notion/disconnect":
      return {
        ...state,
        data: {
          ...state.data,
          notion: { ...state.data.notion, connected: false, mode: "demo", hasToken: false, lastSyncAt: null },
        },
      };
    case "notion/syncing":
      return { ...state, data: { ...state.data, notion: { ...state.data.notion, syncing: action.syncing } } };
    case "notion/synced":
      return {
        ...state,
        data: { ...state.data, notion: { ...state.data.notion, syncing: false, lastSyncAt: new Date().toISOString() } },
      };
    case "activity/push":
      return { ...state, data: { ...state.data, activity: [action.event, ...state.data.activity] } };
    case "incident/create":
      return { ...state, data: { ...state.data, incidents: [action.incident, ...state.data.incidents] } };
    case "incident/status": {
      const incidents = state.data.incidents.map((i) => (i.id === action.id ? { ...i, status: action.status } : i));
      return { ...state, data: { ...state.data, incidents } };
    }
    case "change/apply": {
      const nextData = applyChange(state.data, action.request);
      return { ...state, data: { ...nextData, activity: [...action.activity, ...state.data.activity] } };
    }
    case "volunteer/assign": {
      const volunteers = state.data.volunteers.map((v) =>
        v.id === action.volunteerId
          ? { ...v, status: "assigned" as const, workload: Math.min(100, v.workload + 12) }
          : v,
      );
      return { ...state, data: { ...state.data, volunteers, activity: [action.activity, ...state.data.activity] } };
    }
    case "volunteer/move": {
      const volunteers = state.data.volunteers.map((v) => (v.id === action.volunteerId ? { ...v, teamId: action.toTeamId } : v));
      return { ...state, data: { ...state.data, volunteers, activity: [action.activity, ...state.data.activity] } };
    }
    default:
      return state;
  }
}

interface DataContextValue extends State {
  /** Shared intelligence artefacts, recomputed only when the dataset changes. */
  graph: DependencyGraph;
  risk: RiskReport;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  setTaskProgress: (id: string, progress: number) => void;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAll: () => void;
  connectNotion: (mode: NotionMode) => void;
  disconnectNotion: () => void;
  setSyncing: (syncing: boolean) => void;
  markSynced: () => void;
  taskById: (id: string) => Task | undefined;
  pushActivity: (event: Omit<ActivityEvent, "id" | "at">) => void;
  createIncident: (incident: Omit<Incident, "id" | "timestamp">) => void;
  setIncidentStatus: (id: string, status: IncidentStatus) => void;
  applySimulation: (result: SimulationResult) => void;
  assignVolunteer: (volunteerId: string, note: string) => void;
  moveVolunteer: (volunteerId: string, toTeamId: string, reason: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const initialState: State = {
  data: seedData,
  currentUserId: CURRENT_USER_ID,
  copilot: [],
};

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const nowIso = () => new Date().toISOString();

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const graph = useMemo(() => buildDependencyGraph(state.data), [state.data]);
  const risk = useMemo(() => analyzeRisk(state.data), [state.data]);

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      graph,
      risk,
      setTaskStatus: (id, status) => dispatch({ type: "task/status", id, status }),
      setTaskProgress: (id, progress) => dispatch({ type: "task/progress", id, progress }),
      acknowledgeAlert: (id) => dispatch({ type: "alert/ack", id }),
      acknowledgeAll: () => dispatch({ type: "alert/ackAll" }),
      connectNotion: (mode) => dispatch({ type: "notion/connect", mode }),
      disconnectNotion: () => dispatch({ type: "notion/disconnect" }),
      setSyncing: (syncing) => dispatch({ type: "notion/syncing", syncing }),
      markSynced: () => dispatch({ type: "notion/synced" }),
      taskById: (id) => state.data.tasks.find((t) => t.id === id),
      pushActivity: (event) =>
        dispatch({ type: "activity/push", event: { ...event, id: uid("act"), at: nowIso() } }),
      createIncident: (incident) =>
        dispatch({ type: "incident/create", incident: { ...incident, id: uid("inc"), timestamp: nowIso() } }),
      setIncidentStatus: (id, status) => dispatch({ type: "incident/status", id, status }),
      applySimulation: (result) => {
        const actor = "Aisha Khan";
        const activity: ActivityEvent[] = [
          { id: uid("act"), at: nowIso(), kind: "approval", title: `Change approved: ${result.request.subjectLabel}`, detail: `${result.request.fromValue} → ${result.request.toValue}`, actor, related: [{ kind: result.request.subjectKind, id: result.request.subjectId, label: result.request.subjectLabel }] },
          { id: uid("act"), at: nowIso(), kind: "impact", title: `Impact analysis completed · score ${result.analysis.impactScore}/100`, detail: `${result.analysis.totalAffected} downstream items evaluated`, actor: "NEXUS Impact Engine", related: result.analysis.sourceRecords.slice(0, 4) },
          { id: uid("act"), at: nowIso(), kind: "detection", title: `${result.risks.length} risk conditions detected`, detail: result.risks[0]?.title ?? "No material risk surfaced", actor: "NEXUS Risk Engine", related: result.risks.flatMap((r) => r.related).slice(0, 4) },
          { id: uid("act"), at: nowIso(), kind: "recommendation", title: `${result.actions.length} recommended actions queued`, detail: result.actions[0]?.title ?? "Review with department lead", actor: "NEXUS Recommendation Engine", related: result.actions.flatMap((a) => a.related).slice(0, 4) },
          { id: uid("act"), at: nowIso(), kind: "sync", title: "Notion synchronisation queued", detail: "Affected records will be written back on next sync", actor: "NEXUS Sync", related: [] },
        ];
        dispatch({ type: "change/apply", request: result.request, activity });
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
    }),
    [state, graph, risk],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useNexus(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useNexus must be used within DataProvider");
  return ctx;
}
