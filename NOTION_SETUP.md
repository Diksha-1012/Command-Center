# NEXUS OPS — Notion Integration Setup

NEXUS OPS uses Notion as its durable operational knowledge layer. All Notion
API calls happen **server-side** through the Vite middleware in
`server/notionPlugin.ts`. The browser only ever talks to `/api/notion/*`, and the
token never reaches the client bundle.

```
Frontend (React)
      │  /api/notion/*
      ▼
NEXUS API / server middleware (server/notionPlugin.ts)
      │  Bearer NOTION_API_KEY
      ▼
Notion API (https://api.notion.com/v1)
      │
      ▼
Your Notion workspace
```

Never: `Frontend → Notion API key`.

---

## 1. Create a Notion integration

1. Go to <https://www.notion.so/my-integrations>.
2. Click **New integration**.
3. Give it a name (e.g. `NEXUS OPS`) and select the workspace.
4. Set capabilities to **Read content**, **Update content**, **Insert content**
   (these are the defaults for an internal integration).
5. Click **Submit** and copy the **Internal Integration Secret**.

## 2. Obtain the integration secret

The secret looks like `ntn_…` or `secret_…`. This is the value for
`NOTION_API_KEY`. Treat it like a password.

## 3. Share the required Notion page/database with the integration

A Notion integration can only see content that has been explicitly shared with
it.

1. Open (or create) a page that will host the NEXUS databases.
2. Click **•••** (top-right) → **Connections** → **Connect to** → select your
   `NEXUS OPS` integration.
3. Copy the page id from its URL — the 32-character id after the page title:
   `https://www.notion.so/Your-Page-<PAGE_ID>`. Use it for
   `NOTION_PARENT_PAGE_ID`.

> If you see a `403` / "Integration does not have access", this step was missed.

## 4. Add the credentials to the server environment

Copy `.env.example` to `.env` (gitignored) and fill in:

```dotenv
NOTION_API_KEY=ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_PARENT_PAGE_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Restart the dev server after changing `.env` — the middleware reads it at
startup. If your environment already uses `NOTION_TOKEN`, that name still works.

## 5. Configure database/page ids (optional)

NEXUS can either **create** its databases under the parent page or **map** to
databases you already have. To map, set one variable per database:

```dotenv
NOTION_DB_EVENTS=
NOTION_DB_SESSIONS=
NOTION_DB_TEAMS=
NOTION_DB_MEMBERS=
NOTION_DB_VOLUNTEERS=
NOTION_DB_PARTICIPANTS=
NOTION_DB_TASKS=
NOTION_DB_RESOURCES=
NOTION_DB_INCIDENTS=
NOTION_DB_DEPENDENCIES=
NOTION_DB_COMMUNICATIONS=
NOTION_DB_KNOWLEDGE=
```

Otherwise leave them blank and use the wizard's **Create / map** step, which
provisions the databases (with relations) under `NOTION_PARENT_PAGE_ID`.

## 6. Start NEXUS OPS

```bash
npm install
npm run dev
```

The dev server starts the Notion proxy automatically (`notionProxyPlugin()` in
`vite.config.ts`). For a production build, the same middleware runs under
`npm run preview`.

## 7. Open the Notion Sync Center

In the app, go to **Sync Center** (`/sync`) or the **Notion Wizard** (`/notion`).

- If credentials are configured, the wizard's Step 1 shows
  **LIVE AVAILABLE** and the header reads **NOTION CONNECTED**.
- If not, it shows **NOTION NOT CONNECTED** and explains what to set.

## 8. Verify

Run the wizard (Connect → Select page → Create/map databases → Sync → Verify) or
press **Sync both directions** in the Sync Center. Success means:

- The header shows **● NOTION CONNECTED**.
- **Last sync** shows a timestamp.
- **Recent operations** lists `create` / `update` rows with page ids.
- Creating an incident shows **Notion: ✓ Synced** on the incident card.
- Resolving an incident and pressing **Save to Knowledge → Notion** creates the
  Notion Knowledge record.

You can also check the raw health endpoint:

```bash
curl http://localhost:5173/api/notion/status
```

```json
{
  "available": true,
  "mode": "live",
  "workspaceName": "Your Workspace",
  "databases": [{ "key": "tasks", "name": "NEXUS Tasks", "mapped": true }],
  "lastSyncAt": "2026-10-03T10:42:18.000Z"
}
```

The response **never** contains the token.

---

## DEMO NOTION MODE (no credentials)

If no key is configured, NEXUS does **not** pretend to be connected. It shows
**NOTION NOT CONNECTED** and refuses to record any fake operations.

To exercise the READ/WRITE/UPDATE code paths without a real workspace, enable the
deterministic mock transport:

```dotenv
NEXUS_MOCK_NOTION=1
```

Every response is then marked `mock: true` and the UI shows **DEMO NOTION MODE**.
This is only for demonstrating the integration flow — it is never presented as a
real connection, and no data leaves your machine.

---

## Error handling

The proxy maps Notion failures to actionable, non-secret messages:

| Status | Meaning | Action shown |
| --- | --- | --- |
| `401` | Invalid/revoked token | Generate a new secret, update `NOTION_API_KEY` |
| `403` | Not shared with integration | Share the page/database in Notion |
| `404` | Database/page missing | Verify the id and sharing |
| `409` | Conflict | Retry the write |
| `429` | Rate limited | Wait and retry |
| `5xx` | Notion server error | Retry shortly |
| timeout | No response in 10s | Check connectivity and retry |
| missing creds | No key configured | Set `NOTION_API_KEY` or `NEXUS_MOCK_NOTION=1` |

The app never crashes on a Notion error — local operational state is always
preserved.

---

## Security checklist

- [x] `NOTION_API_KEY` is read only in `server/notionPlugin.ts`.
- [x] No `VITE_`-prefixed secret is used, so nothing is inlined into the bundle.
- [x] `/status` scrubs the token from every response.
- [x] The token is never logged to the console.
- [x] `.env` is gitignored; only `.env.example` (with no real values) is committed.
