# NEXUS OPS — AI-Powered Event Command Center + Dependency Intelligence

> "When one thing changes, NEXUS shows everything that breaks — before it becomes a problem."

Hackathon: **Kaun Banega Codepati 2026 × Kinetex Lab × Notion**
Problem: **KBC-NOTION-03 — Intelligent Team Operations & Event Command Center**

This repository contains **Part 1** (polished command-center prototype), **Part 2**
(the dependency intelligence layer: graph, risk engine, impact analyser, change simulator,
recommendation engine, incident center and audit timeline) and **Part 3** (real Notion
integration, two-way sync, knowledge memory, post-event report, event replay, role-based
views and a mobile volunteer view).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck + production build
npm run typecheck  # tsc --noEmit
npm run preview    # serve the production build
```

No paid services, accounts or network access required — everything runs on the seeded demo dataset.

## Product surface

| Route | Screen | State |
| --- | --- | --- |
| `/` | Overview — hero KPIs, event health, pulse, **NEXUS Daily Brief** | Functional |
| `/events`, `/events/:id` | Event portfolio + dossier | Functional |
| `/command` | Command Center — **Live Risk Map with WHY**, alerts, departments, streams | Functional |
| `/schedule` | Timeline + run-of-show | Functional |
| `/teams` | Departments, leads, workload | Functional |
| `/volunteers` | Roster, **Team Load Map**, **Rebalance**, **Volunteer Intelligence** | Functional |
| `/tasks` | Task board with dependency blockers | Functional |
| `/resources` | Equipment allocation + conflict detection | Functional |
| `/impact` | **Impact Simulator** — blast radius, before/after, risks, actions, apply/discard | Functional |
| `/incidents` | **Incident Center** — create, workflow, dependency blast radius | Functional |
| `/timeline` | **Event Timeline** — audit trail of every change | Functional |
| `/knowledge` | Notion knowledge layer | Demo mode (no live API) |
| `/copilot` | NEXUS Copilot — confidence, WHY, clickable sources | Functional |
| `/notion`, `/sync` | **Notion Wizard** + **Sync Center** — connection, per-database counts, two-way ops | Functional (live when `NOTION_TOKEN` set) |
| `/reports`, `/replay` | **Post-Event Report** + **Event Replay** timeline | Functional |
| `/me`, `/join` | **Mobile Volunteer View** + simulated **QR Join** | Functional |
| `/docs` | Architecture & story | Functional |
| `/settings` | Workspace, roles, data sources, demo reset | Functional |

## Architecture

```
src/
├── types/                All domain entities + graph/risk/impact/simulation contracts
├── data/seed.ts          KINETEX TECHFEST 2026 demo dataset (single source of demo truth)
├── store/                Reducer store: tasks, alerts, incidents, activity, apply-change
├── lib/
│   ├── dependencyEngine.ts     Typed graph (nodes + REQUIRES/USES/DEPENDS_ON/... edges)
│   ├── riskEngine.ts           9 deterministic risk rules + propagation + WHY explanations
│   ├── impactAnalyzer.ts       Blast radius (direct/indirect/potential) + impact score
│   ├── changeSimulator.ts      Pure projection + before/after + actions + applyChange()
│   ├── workloadAnalyzer.ts     Team load map + rebalance suggestions
│   ├── recommendationEngine.ts Explainable volunteer matching (recommend → review → assign)
│   ├── brief.ts                Daily operational brief generator
│   ├── copilot.ts              Grounded Q&A with confidence + source records
│   ├── selectors.ts            Derived KPIs, health, pulse, rollups, conflicts
│   └── format.ts               Date/time + label helpers
├── components/ui/        Design system (panels, badges, charts, drawer, tabs)
├── components/domain/    KPI card, alert card, task row, session drawer, dependency chain,
│                         risk map, assignment card
└── pages/                One module per route
```

**Business logic never lives in components.** Every engine is a pure function module that
takes `NexusData` and returns a typed result — testable, swappable, and independent of React.

### The dependency graph

Nodes are real domain entities (`session:`, `venue:`, `volunteer:`, `resource:`, `task:`,
`team:`, `member:`, `speaker:`, `communication:`, `incident:`), each carrying status, risk and
owner. Edges are derived from actual relationships — never hardcoded visual lines:

`REQUIRES · ASSIGNED_TO · LOCATED_AT · DEPENDS_ON · AFFECTS · OWNED_BY · USES · COMMUNICATES_TO`

Each edge carries a propagation weight. The graph is rebuilt from data automatically, so any
dataset change (including an applied simulation) re-derives it.

### Impact algorithm

Weighted traversal with two rules that keep the blast radius credible:
1. **Transitive dependents** — follow incoming edges: anyone who depends on the changed entity
   is affected, and so are their dependents.
2. **Terminal requirements** — include the changed/affected node's own direct requirements
   (so a venue change surfaces the speakers and equipment its sessions consume), then stop.

Bands: hop 1 = **direct**, hops 2–3 = **indirect**, hop 4+ = **potential**. Confidence decays
25% per hop. The score blends logarithmic volume, breadth across entity kinds, peak risk and
infrastructure weight; it is returned with human-readable `scoreReasons`.

### Risk rules (deterministic — AI is layered on top)

`R-OVERDUE` · `R-BLOCKED` · `R-UNSTARTED-CRITICAL` · `R-PROPAGATE` · `R-RESOURCE` ·
`R-WORKLOAD` · `R-NO-AV` · `R-NO-COVERAGE` · `R-SPEAKER` · `R-SESSION-FLAG` · `R-VENUE` · `R-INCIDENT`

Every finding carries a rule id, severity, human explanation and the related records. The UI
answers **"WHY is this at risk?"** instead of showing an unexplained red badge.

### Change simulator

Simulation is a **pure projection** — it never mutates data. It returns before/after field
diffs, the blast radius, introduced + discovered risks, recommended actions and an AI-generated
explanation with verified source records. Only **Apply change** mutates the store (via
`applyChange`) and writes a five-entry audit trail; **Discard simulation** throws it away.

## Demo scenario (3-minute pitch)

1. Open the **Command Center** and click **Run emergency simulation** (or open the **Impact Simulator**
   and choose **Change venue** → **Hackathon Final Pitch** → **Innovation Hall**).
2. The emergency scene animates the dependency propagation Venue → Sessions → Speakers → Resources →
   Volunteers → Tasks → Communications using the real impact engine.
3. Review the **Impact score**, the AI explanation (labelled `AI GENERATED` with `VERIFIED` source
   chips) and the recommended actions.
4. Click **Apply changes** → sessions relocate, the run-of-show updates, a **critical incident** is
   opened with its blast radius, and the resolution is captured as **reusable knowledge**.
5. Jump to the **Incident Center** and **Knowledge** views from the confirmation panel.
6. Click **Sync to Notion** → the affected records (including the incident and knowledge item) are
   queued for write-back.
7. Open **Timeline** / **Event Replay** → the approval, impact analysis, risk detection,
   recommendations and Notion sync queue are all recorded.
8. Open **Copilot** → ask "What happens if the auditorium changes?" then expand **Why?**

## Honesty contracts

- Copilot answers are tagged `VERIFIED FROM EVENT DATA` (with confidence, reasoning and clickable
  source records) or `AI GENERATED INSIGHT`.
- When no data supports a question the copilot replies *"I don't have enough verified event data to
  answer this"* — it never invents operational facts.
- The recommendation engine **never auto-assigns**. Human path: RECOMMEND → REVIEW → ASSIGN.
- Notion never fakes a live API connection; live mode is disabled and labelled for Part 3.
- Unimplemented features are labelled `COMING NEXT` / `DEMO MODE`, never fake buttons.

## Part 3 — implemented

Part 3 turns the prototype into an operational knowledge layer:

1. **Real Notion integration** — a server-side proxy (`server/notionPlugin.ts`) performs the
   authenticated Notion API calls. The token is read only from the server environment
   (`NOTION_TOKEN`, `NOTION_PARENT_PAGE_ID`) and is never inlined into the browser bundle.
2. **Two-way synchronization** — `NOTION → APP` pulls edits made inside Notion and reconciles them
   into the local operational state; `APP → NOTION` upserts the mapped rows. See the **Notion Sync
   Center** (`/sync`) and the **connection wizard** (`/notion`).
3. **Verified vs AI-generated data** — every AI narrative carries an `AI GENERATED` badge and cites
   the `VERIFIED` source records it was derived from (`SourceBar`).
4. **Knowledge memory** — resolved incidents become reusable memories (`/knowledge`) that sync into
   the Notion Knowledge database.
5. **Post-event report** (`/reports`), **event replay** (`/replay`), **role-based views**
   (Organizer / Ops Lead / Volunteer) and a **mobile volunteer view** (`/me`).

### Notion setup

1. Create a Notion internal integration and copy its secret.
2. Share the target parent page with the integration.
3. Set `NOTION_TOKEN` and `NOTION_PARENT_PAGE_ID` in the server environment, then restart `npm run dev`.
4. Open `/notion` and run the wizard, or go straight to `/sync`.

With no credentials the app runs on clearly labelled **DEMO DATA** with an identical sync model — it
never presents demo data as live synchronization.

### Still not implemented (honestly labelled)

- LLM-backed copilot/narrative — a grounded deterministic engine is used instead.
- Persistent backend — the operational store is in-memory; the durable copy is Notion.
- Notion OAuth public install — an internal integration token is used.
