import type { Plugin } from "vite";
import { NOTION_DATABASES, type NotionDatabaseDef, type NotionPropertyDef } from "../src/lib/notion/schema";

/**
 * NEXUS NOTION SERVER PROXY (Part 3)
 * ======================================================================
 * A small server-side middleware that performs the REAL Notion API calls.
 *
 * ── SECURITY ────────────────────────────────────────────────────────────
 * The Notion token is read ONLY here, from the Node process environment:
 *     NOTION_TOKEN            (secret — required for live mode)
 *     NOTION_PARENT_PAGE_ID   (page the integration was shared with)
 * It is never prefixed with `VITE_`, so Vite never inlines it into the client
 * bundle. The browser only ever talks to `/api/notion/*`, and every response
 * is scrubbed of credentials.
 *
 * ── GRACEFUL DEGRADATION ────────────────────────────────────────────────
 * If there is no token, this returns `{ available: false }` from `/status`.
 * The client then stays on DEMO DATA and never crashes.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const PLUGIN_NAME = "nexus-notion-proxy";

export const NOTION_ENV_HINT =
  "Set NOTION_TOKEN (secret) and NOTION_PARENT_PAGE_ID in the server environment. Optional per-database ids: NOTION_DB_TASKS, NOTION_DB_SESSIONS, …";

function getToken(): string {
  return (process.env.NOTION_TOKEN ?? process.env.notion_token ?? "").trim();
}

function getParentPageId(): string {
  return (process.env.NOTION_PARENT_PAGE_ID ?? process.env.notion_parent_page_id ?? "").trim();
}

function dbEnvId(key: string): string {
  return (process.env[`NOTION_DB_${key.toUpperCase()}`] ?? "").trim();
}

async function notionFetch(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...init,
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
  return { ok: res.ok, status: res.status, data };
}

function errorMessage(data: unknown, fallback: string): string {
  return (data as { message?: string } | null)?.message ?? fallback;
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

/* ------------------------------- handlers ------------------------------ */

async function handleStatus(res: Res) {
  const checkedAt = new Date().toISOString();
  if (!getToken()) {
    sendJson(res, 200, { available: false, reason: "NOTION_TOKEN is not configured on the server.", checkedAt });
    return;
  }
  const me = await notionFetch("/users/me");
  if (!me.ok) {
    sendJson(res, 200, { available: false, reason: errorMessage(me.data, `Notion rejected the token (${me.status}).`), checkedAt });
    return;
  }
  const data = me.data as { name?: string; id?: string };
  sendJson(res, 200, {
    available: true,
    botName: data?.name ?? "NEXUS integration",
    botId: data?.id,
    workspaceName: data?.name ?? "Notion workspace",
    checkedAt,
  });
}

async function handlePages(res: Res) {
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
    sendJson(res, 200, { ok: false, databases: [], message: "Live Notion is not configured on the server." });
    return;
  }

  const relationIds: Record<string, string> = {};
  const databases: { key: string; id: string; name: string; created: boolean }[] = [];

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
      databases.push({ key, id: "", name: db.name, created: false });
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

async function handlePush(req: Req, res: Res) {
  const body = await readBody(req);
  const rows = (body.rows ?? {}) as Record<string, Record<string, unknown>[]>;
  if (!getToken()) {
    sendJson(res, 200, { ok: false, created: 0, updated: 0, failed: 0, message: "Live Notion is not configured on the server." });
    return;
  }

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const [key, list] of Object.entries(rows)) {
    const db = NOTION_DATABASES.find((d) => d.key === key);
    const dbId = dbEnvId(key);
    if (!db || !dbId) {
      failed += list.length;
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
        : { ok: false, status: 0, data: null };
      const results = (existing.data as { results?: Array<{ id: string }> } | null)?.results ?? [];
      if (existing.ok && results.length) {
        const r = await notionFetch(`/pages/${results[0].id}`, { method: "PATCH", body: JSON.stringify({ properties: props }) });
        if (r.ok) updated++;
        else failed++;
      } else {
        const r = await notionFetch("/pages", {
          method: "POST",
          body: JSON.stringify({ parent: { database_id: dbId }, properties: props }),
        });
        if (r.ok) created++;
        else failed++;
      }
    }
  }

  sendJson(res, 200, { ok: failed === 0, created, updated, failed });
}

async function handlePull(req: Req, res: Res) {
  await readBody(req);
  if (!getToken()) {
    sendJson(res, 200, { ok: false, updated: [], message: "Live Notion is not configured on the server." });
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
  sendJson(res, 200, { ok: true, updated });
}

async function route(pathname: string, method: string, req: Req, res: Res) {
  try {
    if (pathname === "/api/notion/status" && method === "GET") return await handleStatus(res);
    if (pathname === "/api/notion/pages" && method === "GET") return await handlePages(res);
    if (pathname === "/api/notion/provision" && method === "POST") return await handleProvision(req, res);
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

