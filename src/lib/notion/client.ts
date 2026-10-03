import type { NexusData } from "@/types";
import { NOTION_DATABASES, type NotionDatabaseDef } from "./schema";

/**
 * NEXUS NOTION CLIENT (Part 3)
 * ======================================================================
 * Thin, typed wrapper around the server-side Notion proxy at `/api/notion/*`.
 *
 * SECURITY: this module NEVER sees the Notion token. All authenticated calls
 * happen inside the Vite/dev server middleware (`server/notionPlugin.ts`) which
 * reads `NOTION_TOKEN` from the server environment (never a `VITE_` variable,
 * so it is never inlined into the client bundle).
 *
 * Every call fails soft: if the proxy is missing, unauthenticated or the
 * network is down, the promise resolves to an "unavailable" shape and the app
 * stays on its local operational state (see DataContext `syncNotion`).
 */

export interface NotionServerStatus {
  available: boolean;
  workspaceName?: string;
  botName?: string;
  botId?: string;
  reason?: string;
  checkedAt: string;
}

export interface NotionPageRef {
  id: string;
  title: string;
  icon?: string;
}

export interface ProvisionRequest {
  parentPageId: string;
  databases: string[];
}

export interface ProvisionResult {
  ok: boolean;
  databases: { key: string; id: string; name: string; created: boolean }[];
  message?: string;
}

export interface PushRequest {
  direction: "app_to_notion";
  /** Rows keyed by database key. */
  rows: Record<string, Record<string, unknown>[]>;
}

export interface PushResult {
  ok: boolean;
  created: number;
  updated: number;
  failed: number;
  message?: string;
}

export interface PullResult {
  ok: boolean;
  /** Per-database, the external id → changed-field map reported by Notion. */
  updated: { database: string; entityId: string; fields: string[] }[];
  message?: string;
}

const BASE = "/api/notion";
const TIMEOUT_MS = 6000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...init,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Notion proxy ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
    }
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Is a real, token-backed Notion connection available right now? */
export async function getNotionStatus(): Promise<NotionServerStatus> {
  try {
    const status = await request<NotionServerStatus>("/status");
    return { ...status, checkedAt: status.checkedAt ?? new Date().toISOString() };
  } catch (err) {
    return {
      available: false,
      reason: err instanceof Error ? err.message : "Notion proxy unreachable",
      checkedAt: new Date().toISOString(),
    };
  }
}

/** Step 2 of the wizard — list pages the integration has been shared with. */
export async function listNotionPages(): Promise<NotionPageRef[]> {
  const res = await request<{ pages: NotionPageRef[] }>("/pages");
  return res.pages ?? [];
}

/** Step 3 — create or map the NEXUS databases under the selected parent page. */
export async function provisionNotionDatabases(req: ProvisionRequest): Promise<ProvisionResult> {
  return request<ProvisionResult>("/provision", { method: "POST", body: JSON.stringify(req) });
}

/** Step 4 (APP → NOTION) — upsert domain rows into the mapped databases. */
export async function pushToNotion(rows: PushRequest["rows"]): Promise<PushResult> {
  return request<PushResult>("/push", { method: "POST", body: JSON.stringify({ direction: "app_to_notion", rows }) });
}

/** Step 4 (NOTION → APP) — detect edits made inside Notion. */
export async function pullFromNotion(): Promise<PullResult> {
  return request<PullResult>("/pull", { method: "POST", body: JSON.stringify({ direction: "notion_to_app" }) });
}

/** Schema descriptor passed to the provisioner so Notion mirrors our model. */
export function schemaForProvision(): NotionDatabaseDef[] {
  return NOTION_DATABASES;
}

/** Convenience: a compact, human count of mapped records for the sync center. */
export function totalMappedRows(data: NexusData): number {
  return (
    data.sessions.length +
    data.tasks.length +
    data.volunteers.length +
    data.resources.length +
    data.dependencies.length +
    data.incidents.length +
    data.communications.length +
    data.members.length +
    data.teams.length +
    data.speakers.length +
    data.venues.length +
    data.knowledge.length
  );
}