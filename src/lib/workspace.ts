import type {
  AccentTone,
  EventRecord,
  NexusData,
  NotionDatabase,
  RecordSource,
  WorkspaceMode,
} from "@/types";
import { NOTION_DATABASES } from "@/lib/notion/schema";

/**
 * NEXUS WORKSPACE (Data Mode architecture)
 * ======================================================================
 * NEXUS OPS runs in exactly one of two clearly separated modes:
 *
 *   DEMO MODE — the synthetic KINETEX TECHFEST 2026 dataset. Every record is
 *               tagged `sourceType: "demo"`.
 *   LIVE MODE — real operational data the user creates. Every record is tagged
 *               `sourceType: "live"` (or "notion" when it came from Notion).
 *
 * The two datasets are held separately in the store and are NEVER mixed.
 * Live data is persisted to localStorage so real records survive reloads.
 */

/* ----------------------------- provenance ----------------------------- */

export const RECORD_SOURCE_META: Record<RecordSource, { label: string; tone: AccentTone; description: string }> = {
  demo: {
    label: "DEMO",
    tone: "warn",
    description: "Synthetic demonstration record — not real operational data.",
  },
  live: {
    label: "LIVE",
    tone: "ok",
    description: "Real operational record created in LIVE mode.",
  },
  notion: {
    label: "NOTION",
    tone: "blue",
    description: "Record synchronized from a connected Notion workspace.",
  },
};

export const MODE_META: Record<WorkspaceMode, { label: string; short: string; tone: AccentTone; description: string }> = {
  demo: {
    label: "DEMO MODE",
    short: "DEMO",
    tone: "warn",
    description:
      "You are viewing synthetic demonstration data for KINETEX TECHFEST 2026. Nothing here is real and nothing is synchronized to Notion.",
  },
  live: {
    label: "LIVE MODE",
    short: "LIVE",
    tone: "ok",
    description:
      "You are viewing real operational data that you created. Demo records are hidden and never mixed with live records.",
  },
};

/* --------------------------- demo tagging ----------------------------- */

/**
 * Tags every record in the demo dataset with `sourceType: "demo"` so the UI can
 * always expose an honest Source label. Applied once at seed time.
 */
export function tagDemoData(data: NexusData): NexusData {
  const tag = <T extends object>(rows: T[]): T[] => rows.map((r) => ({ ...r, sourceType: "demo" as const }));
  return {
    ...data,
    event: { ...data.event, sourceType: "demo" },
    venues: tag(data.venues),
    speakers: tag(data.speakers),
    sessions: tag(data.sessions),
    teams: tag(data.teams),
    members: tag(data.members),
    volunteers: tag(data.volunteers),
    participants: tag(data.participants),
    tasks: tag(data.tasks),
    resources: tag(data.resources),
    dependencies: tag(data.dependencies),
    alerts: tag(data.alerts),
    communications: tag(data.communications),
    schedule: data.schedule,
    knowledge: tag(data.knowledge),
    incidents: tag(data.incidents),
    activity: data.activity,
  };
}

/* ----------------------------- live data ------------------------------ */

const LIVE_NOTION_DATABASES: NotionDatabase[] = NOTION_DATABASES.map((d, i) => ({
  id: `nd-live-${i + 1}`,
  name: d.name.replace("NEXUS ", ""),
  icon: d.icon,
  rowCount: 0,
  mappedEntity: d.mappedEntity === "dependency" ? "none" : d.mappedEntity,
  lastEdited: new Date(0).toISOString(),
}));

/**
 * A blank LIVE workspace. Starts with a single real event shell and empty
 * collections — everything else is entered by the user through the Data Studio.
 */
export function createEmptyLiveData(): NexusData {
  const event: EventRecord = {
    id: "ev-live-1",
    name: "Untitled Live Event",
    tagline: "Real operational workspace — add your event details in Data Studio.",
    date: new Date().toISOString().slice(0, 10),
    venueId: "",
    phase: "preparing",
    organizers: [],
    participantTarget: 0,
    volunteerPool: 0,
    programmeItems: 0,
    sourceType: "live",
  };
  return {
    event,
    venues: [],
    speakers: [],
    sessions: [],
    teams: [],
    members: [],
    volunteers: [],
    participants: [],
    tasks: [],
    resources: [],
    dependencies: [],
    alerts: [],
    communications: [],
    schedule: [],
    knowledge: [],
    notion: {
      mode: "live",
      connected: false,
      workspaceName: "Notion (not connected)",
      lastSyncAt: null,
      syncing: false,
      hasToken: false,
    },
    notionDatabases: LIVE_NOTION_DATABASES,
    healthMetrics: [
      { label: "Planning", score: 0 },
      { label: "Staffing", score: 0 },
      { label: "Technical", score: 0 },
      { label: "Registration", score: 0 },
      { label: "Communication", score: 0 },
      { label: "Logistics", score: 0 },
    ],
    incidents: [],
    activity: [],
  };
}

/* ---------------------------- persistence ----------------------------- */

const LIVE_KEY = "nexus-ops.live-data.v1";
const MODE_KEY = "nexus-ops.mode.v1";

/** True when a durable live dataset exists on this device. */
export function hasPersistedLiveData(): boolean {
  try {
    return localStorage.getItem(LIVE_KEY) != null;
  } catch {
    return false;
  }
}

/** Load the persisted LIVE dataset, or a blank one if none is stored. */
export function loadLiveData(): NexusData {
  try {
    const raw = localStorage.getItem(LIVE_KEY);
    if (!raw) return createEmptyLiveData();
    const parsed = JSON.parse(raw) as NexusData;
    if (!parsed?.event) return createEmptyLiveData();
    return parsed;
  } catch {
    return createEmptyLiveData();
  }
}

/** Persist the LIVE dataset. Only ever called for live data. */
export function saveLiveData(data: NexusData): void {
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable — live state stays in memory for the session */
  }
}

/** Clear the persisted LIVE dataset. Used only by the guarded live reset. */
export function clearPersistedLiveData(): void {
  try {
    localStorage.removeItem(LIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function loadWorkspaceMode(): WorkspaceMode {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    return raw === "live" ? "live" : "demo";
  } catch {
    return "demo";
  }
}

export function saveWorkspaceMode(mode: WorkspaceMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/* ------------------------------ helpers ------------------------------- */

/** A `Source:` label string for any sourced record (falls back to demo). */
export function sourceLabel(record: { sourceType?: RecordSource } | undefined): RecordSource {
  return record?.sourceType ?? "demo";
}

/** Attaches provenance to a freshly-created live record. */
export function withSource<T extends object>(record: T, source: RecordSource = "live"): T & { sourceType: RecordSource } {
  return { ...record, sourceType: source };
}

/** Provenance for derived memories: demo datasets stay demo, live stays live. */
export function memorySourceFor(mode: WorkspaceMode): RecordSource {
  return mode === "demo" ? "demo" : "live";
}
