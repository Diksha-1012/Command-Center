import { useState } from "react";
import { BookOpen, CloudOff, Database, ExternalLink, Link2, Plug, RefreshCw, Sparkles, Terminal } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { BadgeTone, Button, ComingNext, DemoTag, Panel, PanelHeader, SectionTitle, StatusDot } from "@/components/ui/primitives";
import { relativeFromNow } from "@/lib/format";
import { cn } from "@/lib/cn";

export function Knowledge() {
  const { data, connectNotion, disconnectNotion, setSyncing, markSynced } = useNexus();
  const [showToken, setShowToken] = useState(false);
  const notion = data.notion;

  const handleSync = () => {
    if (!notion.connected) return;
    setSyncing(true);
    window.setTimeout(() => markSynced(), 1100);
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Knowledge Layer"
        title="Notion Knowledge Layer"
        description="NEXUS uses Notion as the operational knowledge layer — the durable record behind every live decision."
        action={notion.mode === "demo" ? <DemoTag /> : <BadgeTone tone="ok">LIVE NOTION CONNECTION</BadgeTone>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Connection" subtitle="Workspace link, sync status and mode" icon={<Plug size={14} />} />
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/3 p-3">
              <div className="flex items-center gap-3">
                <span className={cn("grid h-10 w-10 place-items-center rounded-xl border text-lg", notion.connected ? "border-white/12 bg-white/6" : "border-white/10 bg-white/3")}>◻️</span>
                <div>
                  <div className="text-sm text-slate-200">{notion.workspaceName}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <StatusDot tone={notion.connected ? "ok" : "neutral"} />
                    {notion.connected ? `Connected · ${notion.mode.toUpperCase()} mode` : "Not connected"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {notion.connected ? (
                  <>
                    <Button size="sm" variant="outline" onClick={handleSync} disabled={notion.syncing}>
                      <RefreshCw size={13} className={notion.syncing ? "animate-spin" : ""} /> {notion.syncing ? "Syncing…" : "Sync Workspace"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={disconnectNotion}>Disconnect</Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="primary" onClick={() => connectNotion("demo")}>
                      <Link2 size={13} /> Connect Notion (Demo)
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowToken((s) => !s)}>
                      <ExternalLink size={13} /> Live connection
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoTile label="Last Sync" value={notion.lastSyncAt ? relativeFromNow(notion.lastSyncAt, new Date().toISOString()) : "never"} />
              <InfoTile label="Sync Status" value={notion.syncing ? "in progress" : notion.connected ? "idle" : "offline"} tone={notion.syncing ? "warn" : notion.connected ? "ok" : "neutral"} />
              <InfoTile label="Databases mapped" value={String(data.notionDatabases.length)} />
            </div>

            {showToken ? (
              <div className="rounded-xl border border-amber-400/25 bg-amber-500/6 p-3">
                <div className="flex items-center gap-2">
                  <CloudOff size={14} className="text-amber-300" />
                  <span className="text-xs font-semibold text-amber-200">Live Notion connection is not enabled in Part 1</span>
                  <ComingNext label="OAUTH + API — PART 3" />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  NEXUS does not fake a live Notion API connection. In Part 3 this flow will run a real OAuth install,
                  store the integration token server-side, and stream workspace changes into the dependency graph.
                  A pasted token would not be verified here, so the field is disabled intentionally.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    disabled
                    placeholder="secret_… (disabled in Part 1)"
                    className="flex-1 rounded-lg border border-white/10 bg-ink-850 px-3 py-2 text-xs text-slate-400 placeholder:text-slate-600"
                  />
                  <Button size="sm" variant="outline" disabled>Connect live</Button>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-violet-400/15 bg-violet-500/6 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-300">
                <Sparkles size={11} /> How the knowledge layer works
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-300">
                Operational tables live in Notion (Events, Sessions, Tasks, Volunteers, Resources…). NEXUS reads them
                into a structured graph, watches for edits, and re-computes downstream impact. Notion stays the source
                of truth; NEXUS is the intelligence layer on top.
              </p>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Integration Roadmap" subtitle="What is real vs planned" icon={<Terminal size={14} />} />
          <div className="space-y-2 p-4">
            {[
              { label: "Structured entity mapping", done: true },
              { label: "Manual demo workspace", done: true },
              { label: "Sync simulation + status", done: true },
              { label: "OAuth install flow", done: false },
              { label: "Bi-directional write-back", done: false },
              { label: "Change webhooks → impact engine", done: false },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/3 p-2.5">
                <span className={cn("grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold", row.done ? "bg-emerald-500/15 text-emerald-300" : "bg-white/6 text-slate-400")}>
                  {row.done ? "✓" : "○"}
                </span>
                <span className="text-xs text-slate-300">{row.label}</span>
                {!row.done ? <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-600">part 3</span> : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Planned Databases" subtitle="Notion databases NEXUS maps onto its domain model" icon={<Database size={14} />} />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          {data.notionDatabases.map((db) => (
            <div key={db.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
              <div className="flex items-center justify-between">
                <span className="text-lg">{db.icon}</span>
                {db.mappedEntity !== "none" ? <BadgeTone tone="ok">mapped</BadgeTone> : <BadgeTone tone="warn">pending</BadgeTone>}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-200">{db.name}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{db.rowCount} rows · edited {relativeFromNow(db.lastEdited, "2026-11-15T14:20:00")}</div>
              <div className="mt-2 text-[10px] uppercase tracking-wide text-slate-600">
                entity: {db.mappedEntity}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Knowledge Items" subtitle="Internal playbooks and docs indexed for the copilot" icon={<BookOpen size={14} />} />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {data.knowledge.map((k) => (
            <div key={k.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-200">{k.title}</span>
                <BadgeTone tone="ai">{k.category}</BadgeTone>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">{k.summary}</p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600">
                <span className="inline-flex items-center gap-1"><BookOpen size={10} /> notion:{k.notionPageId}</span>
                <span>updated {k.updatedAt.slice(11, 16)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function InfoTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "ok" | "warn" | "neutral" }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <StatusDot tone={tone === "ok" ? "ok" : tone === "warn" ? "warn" : "neutral"} /> {label}
      </div>
      <div className="mt-1 text-sm text-slate-200">{value}</div>
    </div>
  );
}
