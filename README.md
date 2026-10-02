# NEXUS OPS — AI-Powered Event Command Center

> "When one thing changes, NEXUS shows everything that breaks — before it becomes a problem."

Hackathon: **Kaun Banega Codepati 2026 × Kinetex Lab × Notion**
Problem: **KBC-NOTION-03 — Intelligent Team Operations & Event Command Center**

This repository contains **Part 1**: a polished, functional prototype built on a clean,
extensible architecture. Parts 2 and 3 add the real dependency engine, persistence and
LLM/Notion integrations without changing the UI contracts.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # typecheck + production build
npm run typecheck  # tsc --noEmit
npm run preview    # serve the production build
```

No paid services, accounts or network access are required — the app runs entirely on the
seeded demo dataset.

## Product surface

| Route | Screen | State |
| --- | --- | --- |
| `/` | Overview — hero dashboard, KPIs, event health, pulse | Functional |
| `/events`, `/events/:id` | Event portfolio + dossier | Functional |
| `/command` | Command Center — live ops, alerts, streams | Functional |
| `/schedule` | Timeline + run-of-show table | Functional |
| `/teams` | Departments, leads, workload | Functional |
| `/volunteers` | Roster, workload bands, coverage gaps | Functional |
| `/tasks` | Task board (All / Mine / Critical / Overdue / Today / Completed) | Functional |
| `/resources` | Equipment allocation + conflict detection | Functional |
| `/impact` | Impact Simulator — change preview + dependency chain | Demo mode (seeded graph) |
| `/knowledge` | Notion knowledge layer | Demo mode (no live API) |
| `/copilot` | NEXUS Copilot chat | Deterministic engine, LLM-ready |
| `/settings` | Workspace, roles, data sources, demo reset | Functional |

## Architecture

```
src/
├── types/          All domain entities + the dependency/impact/copilot contracts
├── data/seed.ts    KINETEX TECHFEST 2026 demo dataset (single source of demo truth)
├── store/          Reducer-backed data store (task status/progress, alerts, Notion)
├── lib/
│   ├── selectors.ts  Derived KPIs, health, pulse, team rollups, conflicts
│   ├── impact.ts      Dependency graph builder + shallow impact traversal (v0)
│   ├── copilot.ts     Deterministic, source-attributed answers
│   └── format.ts      Date/time + label helpers
├── components/
│   ├── ui/           Design system (panels, badges, charts, drawer, tabs)
│   ├── domain/       Domain components (KPI card, alert card, task row, session drawer, dependency chain)
│   └── layout/       Shell, sidebar, topbar
└── pages/          One module per route
```

**Business logic never lives in components.** UI reads derived data through `lib/selectors.ts`
and `lib/impact.ts`; the store owns mutations.

### Honesty contracts (carried into later parts)

- **Copilot answers** are tagged `VERIFIED FROM EVENT DATA` (with citation chips) or
  `AI GENERATED INSIGHT`. The engine never presents generated text as verified.
- **Notion** never fakes a live API connection. Live mode is explicitly disabled in Part 1
  and labelled `OAUTH + API — PART 3`.
- **Unimplemented features** are labelled `COMING NEXT` / `DEMO MODE`, never fake buttons.

## What Part 2 should implement

1. Real dependency engine: weighted edges, mitigation paths, confidence, rollback.
2. Backend + persistence (tasks, alerts, simulations) replacing the in-memory store.
3. Notion read adapter (databases → domain entities) behind the existing `NexusData` shape.
4. Volunteer skill-matched auto-allocation.
5. Auth + per-role views (Technical, Marketing, Volunteer Coordinator).

## What Part 3 should implement

1. Live Notion OAuth install + webhook-driven impact recomputation.
2. LLM-backed Copilot with retrieval over Notion + backend, preserving source badges.
3. Real-time collaboration and audit trail.
