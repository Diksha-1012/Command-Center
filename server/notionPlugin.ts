import type { Plugin } from "vite";
import { NOTION_DATABASES, type NotionDatabaseDef, type NotionPropertyDef } from "../src/lib/notion/schema";

/**
 * NEXUS NOTION SERVER PROXY (Part 3)
 * ======================================================================
 * A small server-side middleware that performs the REAL Notion API calls.
 *
 * ── SECURITY ────────────────────────────────────────────────────────────
 * The Notion token is read ONLY here, from the Node process environment:
 *     NOTION_API_KEY (or NOTION_TOKEN)   secret — required for live mode
 *     NOTION_PARENT_PAGE_ID              page the integration was shared with
 *     NOTION_DB_<KEY>                    optional pre-existing database ids
 * It is never prefixed with `VITE_`, so Vite never inlines it into the client
 * bundle. The browser only ever talks to `/api/notion/*`, and every response
 * is scrubbed of credentials.
 *
 * ── MODES ───────────────────────────────────────────────────────────────
 *   live   — a real token is configured and verified against /users/me
 *   mock   — NEXUS_MOCK_NOTION=1: a safe, deterministic in-memory Notion used
 *            to exercise READ/WRITE/UPDATE without credentials. Every response
 *            is marked `mock: true` so the UI can label it DEMO NOTION MODE.
 *   offline— no credentials and no mock: /status returns available:false and
 *            the app stays on local data. It never pretends to be connected.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const PLUGIN_NAME = "nexus-notion-proxy";
const TIMEOUT_MS = 10_000;

export const NOTION_ENV_HINT =
  "Set NOTION_API_KEY (or NOTION_TOKEN) and NOTION_PARENT_PAGE_ID in the server environment. Optional per-database ids: NOTION_DB_TASKS, NOTION_DB_SESSIONS, … Set NEXUS_MOCK_NOTION=1 to exercise READ/WRITE/UPDATE without credentials.";

function getToken(): string {
  return (process.env.NOTION_API_KEY ?? process.env.NOTION_TOKEN ?? process.env.notion_api_key ?? process.env.notion_token ?? "").trim();
}

function getParentPageId(): string {
  return (process.env.NOTION_PARENT_PAGE_ID ?? process.env.notion_parent_page_id ?? "").trim();
}

function dbEnvId(key: string): string {
  return (process.env[`NOTION_DB_${key.toUpperCase()}`] ?? "").trim();
}

function mockEnabled(): boolean {
  const v = (process.env.NEXUS_MOCK_NOTION ?? process.env.nexus_mock_notion ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/* ------------------------------- errors -------------------------------- */

/**
 * A user-facing, non-secret error with an actionable message. Never contains the
 * token. The `code` maps to the HTTP status Notion returned.
 */
export interface NotionErrorInfo {
  code: number | string;
  reason: string;
  action: string;
}

const STATUS_ACTION: Record<number, string> = {
  400: "Check the request payload and database ids.",
  401: "The integration token is invalid or revoked. Generate a new secret and update NOTION_API_KEY.",
  403: "The integration is not authorised for this resource. Share the page/database with the NEXUS integration in Notion.",
  404: "The database or page was not found. Verify the id and that it is shared with the integration.",
  409: "Notion reported a conflict. Retry the write.",
  429: "Notion rate-limited the request. Wait a moment and retry.",
  500: "Notion had a server error. Retry shortly.",
  502: "Notion returned a bad gateway. Retry shortly.",
  503: "Notion is temporarily unavailable. Retry shortly.",
};

function errorInfo(status: number, data: unknown): NotionErrorInfo {
  const message = (data as { message?: string } | null)?.message ?? `Notion request failed (${status}).`;
  return {
    code: status,
    reason: message,
    action: STATUS_ACTION[status] ?? "Retry the operation; if it persists, re-check the integration setup.",
  };
}

function timeoutError(): NotionErrorInfo {
  return { code: "timeout", reason: `Notion did not respond within ${TIMEOUT_MS / 1000}s.`, action: "Check network connectivity and retry." };
}

function missingCredsError(): NotionErrorInfo {
  return {
    code: "no-credentials",
    reason: "No Notion API key is configured on the server.",
    action: "Set NOTION_API_KEY (and NOTION_PARENT_PAGE_ID) in the server environment, or set NEXUS_MOCK_NOTION=1 for demo mode.",
  };
}

/* ------------------------------ transport ------------------------------ */

async function notionFetch(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: unknown; error?: NotionErrorInfo }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${NOTION_API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { message: text };
    }
    return res.ok ? { ok: true, status: res.status, data } : { ok: false, status: res.status, data, error: errorInfo(res.status, data) };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, status: 0, data: null, error: aborted ? timeoutError() : { code: "network", reason: err instanceof Error ? err.message : "Network error.", action: "Check connectivity and retry." } };
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------- property mapping -------------------------- */

type Req = { url?: string; method?: string; on: (e: string, cb: (c?: unknown) => void) => void };
type Res = { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void };

/** Convert our schema definition of a property into a Notion property schema. */
function toNotionProperty(def: NotionPropertyDef, relationIds: Record<string, string>): Record<string, unknown> | null {
  switch (def.type) {
    case "title":
      return { title: {} };
    case "rich_text":
      return { rich_text: {} };
    case "number":
      return { number: { format: "number" } };
    case "date":
      return { date: {} };
    case "checkbox":
      return { checkbox: {} };
    case "url":
      return { url: {} };
    case "select":
      return { select: { options: (def.options ?? []).map((name) => ({ name })) } };
    case "multi_select":
      return { multi_select: { options: (def.options ?? []).map((name) => ({ name })) } };
    case "status":
      return { status: { options: (def.options ?? []).map((name) => ({ name })) } };
    case "relation": {
      const database_id = def.relationTo ? relationIds[def.relationTo] : undefined;
      return database_id ? { relation: { database_id } } : null;
    }
    default:
      return null;
  }
}

/** Convert a mapped row value into a Notion property value. */
function toNotionValue(def: NotionPropertyDef, value: unknown): Record<string, unknown> | null {
  switch (def.type) {
    case "title":
      return { title: [{ text: { content: String(value ?? "") } }] };
    case "rich_text":
      return { rich_text: [{ text: { content: String(value ?? "") } }] };
    case "number":
      return { number: typeof value === "number" ? value : Number(value ?? 0) };
    case "checkbox":
      return { checkbox: Boolean(value) };
    case "url":
      return { url: String(value ?? "") || null };
    case "date":
      return value ? { date: { start: String(value) } } : null;
    case "select":
      return value ? { select: { name: String(value) } } : null;
    case "multi_select": {
      const arr = Array.isArray(value) ? value : value ? [value] : [];
      return { multi_select: arr.map((v) => ({ name: String(v) })) };
    }
    case "status":
      return value ? { status: { name: String(value) } } : null;
    case "relation":
      // Relations reference Notion page ids; the mapper emits domain ids, so they
      // are reconciled on pull rather than pushed. Documented, not silently lost.
      return null;
    default:
      return null;
  }
}

/**
 * Convert a Notion page's properties back into our plain row shape (READ path).
 * Mirrors `toNotionValue` so a round-trip preserves values.
 */
function fromNotionValue(def: NotionPropertyDef, value: unknown): unknown {
  const v = value as Record<string, unknown> | null;
  if (!v) return undefined;
  switch (def.type) {
    case "title":
      return (v.title as Array<{ plain_text?: string }> | undefined)?.map((t) => t.plain_text ?? "").join("") ?? "";
    case "rich_text":
      return (v.rich_text as Array<{ plain_text?: string }> | undefined)?.map((t) => t.plain_text ?? "").join("") ?? "";
    case "number":
      return v.number ?? 0;
    case "checkbox":
      return Boolean(v.checkbox);
    case "url":
      return v.url ?? "";
    case "date":
      return (v.date as { start?: string } | null)?.start ?? "";
    case "select":
      return (v.select as { name?: string } | null)?.name ?? "";
    case "multi_select":
      return (v.multi_select as Array<{ name?: string }> | undefined)?.map((o) => o.name ?? "") ?? [];
    case "status":
      return (v.status as { name?: string } | null)?.name ?? "";
    case "relation":
      return (v.relation as Array<{ id?: string }> | undefined)?.map((r) => r.id ?? "") ?? [];
    default:
      return undefined;
  }
}

function databaseSchema(db: NotionDatabaseDef, relationIds: Record<string, string>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const def of db.properties) {
    const converted = toNotionProperty(def, relationIds);
    if (converted) properties[def.name] = converted;
  }
  return properties;
}

function rowToProperties(db: NotionDatabaseDef, row: Record<string, unknown>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const def of db.properties) {
    const converted = toNotionValue(def, row[def.name]);
    if (converted) properties[def.name] = converted;
  }
  return properties;
}

function pageToRow(db: NotionDatabaseDef, page: Record<string, unknown>): Record<string, unknown> {
  const props = (page.properties ?? {}) as Record<string, unknown>;
  const row: Record<string, unknown> = { __pageId: String(page.id ?? ""), __databaseId: String((page.parent as { database_id?: string } | null)?.database_id ?? "") };
  for (const def of db.properties) {
    const value = fromNotionValue(def, props[def.name]);
    if (value !== undefined) row[def.name] = value;
  }
  return row;
}

/* ------------------------------- helpers ------------------------------- */

function readBody(req: Req): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += String(chunk ?? "");
    });
    req.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res: Res, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

async function listPages() {
  const r = await notionFetch("/search", {
    method: "POST",
    body: JSON.stringify({ filter: { property: "object", value: "page" }, page_size: 25 }),
  });
  if (!r.ok) return [];
  const results = (r.data as { results?: Array<Record<string, unknown>> }).results ?? [];
  return results.map((p) => {
    const props = (p.properties ?? {}) as Record<string, { title?: Array<{ plain_text?: string }> }>;
    const titleKey = Object.keys(props).find((k) => props[k]?.title);
    const title = titleKey ? (props[titleKey].title ?? []).map((t) => t.plain_text ?? "").join("") : "";
    const icon = (p.icon ?? null) as { emoji?: string } | null;
    return { id: String(p.id ?? ""), title: title || "Untitled page", icon: icon?.emoji };
  });
}

/* ------------------------------ mock store ----------------------------- */

/**
 * A deterministic in-memory Notion used ONLY when NEXUS_MOCK_NOTION is set and
 * no real token exists. It supports READ/WRITE/UPDATE so the integration can be
 * exercised end-to-end without credentials. Every response carries `mock: true`
 * and the UI labels the whole session DEMO NOTION MODE.
 */
const mockPages = new Map<string, Record<string, unknown>>();

function mockDatabaseId(key: string): string {
  return `mock-db-${key}`;
}

function mockPush(rows: Record<string, Record<string, unknown>[]>): {
  created: number;
  updated: number;
  failed: number;
  results: PushRowResult[];
} {
  const results: PushRowResult[] = [];
  let created = 0;
  let updated = 0;
  for (const [key, list] of Object.entries(rows)) {
    const db = NOTION_DATABASES.find((d) => d.key === key);
    if (!db) {
      for (const row of list) results.push({ database: key, key, entityId: String(row.id ?? ""), status: "failed", error: "Unknown database." });
      continue;
    }
    for (const row of list) {
      const pk = String(row[db.primaryKey] ?? "");
      const pageId = `mock-page-${key}-${pk}`;
      const existed = mockPages.has(pageId);
      mockPages.set(pageId, { id: pageId, database: key, properties: row });
      if (existed) updated++;
      else created++;
      results.push({
        database: db.name,
        key,
        entityId: pk,
        status: existed ? "updated" : "created",
        pageId,
        databaseId: mockDatabaseId(key),
      });
    }
  }
  return { created, updated, failed: results.filter((r) => r.status === "failed").length, results };
}

/* ------------------------------- handlers ------------------------------ */

interface PushRowResult {
  database: string;
  key: string;
  entityId: string;
  status: "created" | "updated" | "failed";
  pageId?: string;
  databaseId?: string;
  error?: string;
}

let lastSyncAt: string | null = null;

async function handleStatus(res: Res) {
  const checkedAt = new Date().toISOString();
  const databases = NOTION_DATABASES.map((d) => ({ key: d.key, name: d.name, mapped: Boolean(dbEnvId(d.key)), databaseId: dbEnvId(d.key) || null }));

  if (!getToken()) {
    if (mockEnabled()) {
      sendJson(res, 200, {
        available: true,
        mock: true,
        mode: "mock",
        botName: "NEXUS MOCK integration",
        workspaceName: "DEMO NOTION WORKSPACE",
        databases,
        lastSyncAt,
        checkedAt,
      });
      return;
    }
    sendJson(res, 200, { available: false, mock: false, mode: "offline", reason: missingCredsError().reason, action: missingCredsError().action, databases, lastSyncAt: null, checkedAt });
    return;
  }

  const me = await notionFetch("/users/me");
  if (!me.ok) {
    const info = me.error ?? errorInfo(me.status, me.data);
    sendJson(res, 200, { available: false, mock: false, mode: "offline", reason: info.reason, action: info.action, error: info, databases, lastSyncAt, checkedAt });
    return;
  }
  const data = me.data as { name?: string; id?: string };
  sendJson(res, 200, {
    available: true,
    mock: false,
    mode: "live",
    botName: data?.name ?? "NEXUS integration",
    botId: data?.id,
    workspaceName: data?.name ?? "Notion workspace",
    parentPageId: getParentPageId() || null,
    databases,
    lastSyncAt,
    checkedAt,
  });
}

async function handlePages(res: Res) {
  if (!getToken() && mockEnabled()) {
    sendJson(res, 200, { pages: [{ id: "mock-parent-page", title: "DEMO NOTION WORKSPACE · Operations Hub", icon: "◻️" }], parentPageId: getParentPageId() || "mock-parent-page", mock: true });
    return;
  }
  const pages = await listPages();
  sendJson(res, 200, { pages, parentPageId: getParentPageId() });
}

async function handleProvision(req: Req, res: Res) {
  const body = await readBody(req);
  const parentPageId = String(body.parentPageId || getParentPageId());
  const keys = Array.isArray(body.databases) ? (body.databases as string[]) : NOTION_DATABASES.map((d) => d.key);
  if (!parentPageId) {
    sendJson(res, 400, { ok: false, databases: [], message: "No parent page selected." });
    return;
  }
  if (!getToken()) {
    if (mockEnabled()) {
      sendJson(res, 200, { ok: true, mock: true, databases: keys.map((key) => ({ key, id: mockDatabaseId(key), name: NOTION_DATABASES.find((d) => d.key === key)?.name ?? key, created: true })) });
      return;
    }
    sendJson(res, 200, { ok: false, databases: [], message: "Live Notion is not configured on the server." });
    return;
  }

  const relationIds: Record<string, string> = {};
  const databases: { key: string; id: string; name: string; created: boolean; error?: string }[] = [];

  // Pass 1 — create each database with non-relation properties.
  for (const key of keys) {
    const db = NOTION_DATABASES.find((d) => d.key === key);
    if (!db) continue;
    const r = await notionFetch("/databases", {
      method: "POST",
      body: JSON.stringify({
        parent: { type: "page_id", page_id: parentPageId },
        title: [{ type: "text", text: { content: db.name } }],
        properties: databaseSchema(db, {}),
      }),
    });
    if (r.ok) {
      const id = String((r.data as { id?: string }).id ?? "");
      relationIds[key] = id;
      databases.push({ key, id, name: db.name, created: true });
    } else {
      databases.push({ key, id: "", name: db.name, created: false, error: r.error?.reason });
    }
  }

  // Pass 2 — patch in relation properties now that every database has an id.
  for (const key of keys) {
    const db = NOTION_DATABASES.find((d) => d.key === key);
    const id = relationIds[key];
    if (!db || !id) continue;
    if (db.properties.some((p) => p.type === "relation")) {
      await notionFetch(`/databases/${id}`, { method: "PATCH", body: JSON.stringify({ properties: databaseSchema(db, relationIds) }) });
    }
  }

  sendJson(res, 200, { ok: databases.some((d) => d.created), databases });
}

/** NOTION → APP. Return real rows (with page ids) for the requested databases. */
async function handleRead(req: Req, res: Res) {
  const body = await readBody(req);
  const keys = Array.isArray(body.databases) && body.databases.length ? (body.databases as string[]) : NOTION_DATABASES.map((d) => d.key);
  const limit = typeof body.limit === "number" ? body.limit : 50;

  if (!getToken()) {
    if (mockEnabled()) {
      const databases = keys
        .map((key) => {
          const db = NOTION_DATABASES.find((d) => d.key === key);
          if (!db) return null;
          const rows = [...mockPages.values()].filter((p) => p.database === key).map((p) => ({ ...(p.properties as Record<string, unknown>), __pageId: p.id, __databaseId: mockDatabaseId(key) }));
          return { key, name: db.name, databaseId: mockDatabaseId(key), rows };
        })
        .filter(Boolean);
      sendJson(res, 200, { ok: true, mock: true, databases });
      return;
    }
    const info = missingCredsError();
    sendJson(res, 200, { ok: false, mock: false, databases: [], error: info, message: info.reason });
    return;
  }

  const databases: { key: string; name: string; databaseId: string; rows: Record<string, unknown>[]; error?: NotionErrorInfo }[] = [];
  for (const key of keys) {
    const db = NOTION_DATABASES.find((d) => d.key === key);
    if (!db) continue;
    const dbId = dbEnvId(key);
    if (!dbId) {
      databases.push({ key, name: db.name, databaseId: "", rows: [], error: { code: "no-database-id", reason: `${db.name} has no configured database id.`, action: `Set NOTION_DB_${key.toUpperCase()} or run the provisioning step.` } });
      continue;
    }
    const r = await notionFetch(`/databases/${dbId}/query`, { method: "POST", body: JSON.stringify({ page_size: limit }) });
    if (!r.ok) {
      databases.push({ key, name: db.name, databaseId: dbId, rows: [], error: r.error ?? errorInfo(r.status, r.data) });
      continue;
    }
    const results = (r.data as { results?: Array<Record<string, unknown>> }).results ?? [];
    databases.push({ key, name: db.name, databaseId: dbId, rows: results.map((p) => pageToRow(db, p)) });
  }
  sendJson(res, 200, { ok: true, mock: false, databases });
}

/** APP → NOTION. Upsert every row, returning a per-row result with the page id. */
async function handlePush(req: Req, res: Res) {
  const body = await readBody(req);
  const rows = (body.rows ?? {}) as Record<string, Record<string, unknown>[]>;

  if (!getToken()) {
    if (mockEnabled()) {
      const out = mockPush(rows);
      lastSyncAt = new Date().toISOString();
      sendJson(res, 200, { ok: out.failed === 0, mock: true, created: out.created, updated: out.updated, failed: out.failed, results: out.results, syncedAt: lastSyncAt });
      return;
    }
    const info = missingCredsError();
    sendJson(res, 200, { ok: false, mock: false, created: 0, updated: 0, failed: 0, results: [], error: info, message: info.reason });
    return;
  }

  const results: PushRowResult[] = [];
  for (const [key, list] of Object.entries(rows)) {
    const db = NOTION_DATABASES.find((d) => d.key === key);
    const dbId = dbEnvId(key);
    if (!db || !dbId) {
      for (const row of list) {
        results.push({ database: db?.name ?? key, key, entityId: String(row[db?.primaryKey ?? "id"] ?? ""), status: "failed", error: db ? `${db.name} has no configured database id (set NOTION_DB_${key.toUpperCase()}).` : "Unknown database." });
      }
      continue;
    }
    for (const row of list) {
      const props = rowToProperties(db, row);
      const pkValue = String(row[db.primaryKey] ?? "");
      const existing = pkValue
        ? await notionFetch(`/databases/${dbId}/query`, {
            method: "POST",
            body: JSON.stringify({ filter: { property: db.primaryKey, rich_text: { equals: pkValue } }, page_size: 1 }),
          })
        : { ok: false, status: 0, data: null as unknown };
      const existingResults = (existing.data as { results?: Array<{ id: string }> } | null)?.results ?? [];
      if (existing.ok && existingResults.length) {
        const r = await notionFetch(`/pages/${existingResults[0].id}`, { method: "PATCH", body: JSON.stringify({ properties: props }) });
        results.push(
          r.ok
            ? { database: db.name, key, entityId: pkValue, status: "updated", pageId: existingResults[0].id, databaseId: dbId }
            : { database: db.name, key, entityId: pkValue, status: "failed", error: r.error?.reason ?? "Update failed." },
        );
      } else {
        const r = await notionFetch("/pages", { method: "POST", body: JSON.stringify({ parent: { database_id: dbId }, properties: props }) });
        const pageId = String((r.data as { id?: string } | null)?.id ?? "");
        results.push(
          r.ok
            ? { database: db.name, key, entityId: pkValue, status: "created", pageId, databaseId: dbId }
            : { database: db.name, key, entityId: pkValue, status: "failed", error: r.error?.reason ?? "Create failed." },
        );
      }
    }
  }

  const created = results.filter((r) => r.status === "created").length;
  const updated = results.filter((r) => r.status === "updated").length;
  const failed = results.filter((r) => r.status === "failed").length;
  if (failed === 0) lastSyncAt = new Date().toISOString();
  sendJson(res, 200, { ok: failed === 0, mock: false, created, updated, failed, results, syncedAt: lastSyncAt });
}

async function handlePull(req: Req, res: Res) {
  await readBody(req);
  if (!getToken()) {
    if (mockEnabled()) {
      sendJson(res, 200, { ok: true, mock: true, updated: [], message: "DEMO NOTION MODE — no remote edits." });
      return;
    }
    const info = missingCredsError();
    sendJson(res, 200, { ok: false, mock: false, updated: [], error: info, message: info.reason });
    return;
  }
  const updated: { database: string; entityId: string; fields: string[] }[] = [];
  for (const db of NOTION_DATABASES) {
    const dbId = dbEnvId(db.key);
    if (!dbId) continue;
    const r = await notionFetch(`/databases/${dbId}/query`, {
      method: "POST",
      body: JSON.stringify({ page_size: 25, sorts: [{ timestamp: "last_edited_time", direction: "descending" }] }),
    });
    if (!r.ok) continue;
    const results = (r.data as { results?: Array<Record<string, unknown>> }).results ?? [];
    for (const page of results.slice(0, 5)) {
      const props = (page.properties ?? {}) as Record<string, { rich_text?: Array<{ plain_text?: string }> }>;
      const entityId = props[db.primaryKey]?.rich_text?.[0]?.plain_text ?? String(page.id ?? "");
      updated.push({ database: db.name, entityId, fields: ["edited in Notion"] });
    }
  }
  lastSyncAt = new Date().toISOString();
  sendJson(res, 200, { ok: true, mock: false, updated, syncedAt: lastSyncAt });
}

async function route(pathname: string, method: string, req: Req, res: Res) {
  try {
    if (pathname === "/api/notion/status" && method === "GET") return await handleStatus(res);
    if (pathname === "/api/notion/pages" && method === "GET") return await handlePages(res);
    if (pathname === "/api/notion/provision" && method === "POST") return await handleProvision(req, res);
    if (pathname === "/api/notion/read" && method === "POST") return await handleRead(req, res);
    if (pathname === "/api/notion/push" && method === "POST") return await handlePush(req, res);
    if (pathname === "/api/notion/pull" && method === "POST") return await handlePull(req, res);
    sendJson(res, 404, { ok: false, message: "Unknown Notion endpoint." });
  } catch (err) {
    sendJson(res, 500, { ok: false, message: err instanceof Error ? err.message : "Notion proxy error." });
  }
}

/* ------------------------------- plugin -------------------------------- */

export function notionProxyPlugin(): Plugin {
  const middleware = (req: Req, res: Res, next: () => void) => {
    const url = req.url ?? "";
    if (!url.startsWith("/api/notion")) {
      next();
      return;
    }
    const pathname = url.split("?")[0];
    void route(pathname, (req.method ?? "GET").toUpperCase(), req, res);
  };

  return {
    name: PLUGIN_NAME,
    configureServer(server) {
      server.middlewares.use(middleware as never);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware as never);
    },
  };
}
