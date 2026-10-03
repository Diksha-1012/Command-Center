import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Database, ExternalLink, Link2, Loader2, Plug, RefreshCw, Server, Sparkles } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { NOTION_DATABASES, NOTION_ENV_KEYS } from "@/lib/notion/schema";
import { mapDataToRows, rowCounts } from "@/lib/notion/mapping";
import { listNotionPages, provisionNotionDatabases } from "@/lib/notion/client";
import { BadgeTone, Button, DemoTag, EmptyState, Panel, PanelHeader, SectionTitle, StatusDot } from "@/components/ui/primitives";
import { ErrorBlock, LoadingBlock, Notice, StatChip } from "@/components/ui/StateBlocks";
import { cn } from "@/lib/cn";

/**
 * NOTION CONNECTION WIZARD (Part 3)
 * ======================================================================
 * Step 1 Connect · Step 2 Select workspace/page · Step 3 Create or map
 * databases · Step 4 Sync · Step 5 Verify.
 *
 * The wizard NEVER handles the token. In live mode it only talks to the
 * server-side proxy; the token lives in the server environment.
 */

const STEPS = [
  { n: 1, label: "Connect Notion" },
  { n: 2, label: "Select workspace/page" },
  { n: 3, label: "Create or map databases" },
  { n: 4, label: "Sync" },
  { n: 5, label: "Verify" },
] as const;

export function NotionConnect() {
  const {
    data, connection, serverStatus, sync, memories,
    patchConnection, connectNotion, disconnectNotion, refreshServerStatus, syncNotion,
  } = useNexus();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<string[]>(
    connection.selectedDatabaseIds.length ? connection.selectedDatabaseIds : NOTION_DATABASES.map((d) => d.key),
  );
  const [syncing, setSyncing] = useState(false);

  const counts = useMemo(() => rowCounts(mapDataToRows(data, memories)), [data, memories]);
  const step = connection.step;

  useEffect(() => {
    void refreshServerStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveReady = serverStatus.available;
  const goStep = (n: 1 | 2 | 3 | 4 | 5) => patchConnection({ step: n });

  const handleConnect = async () => {
    const status = await refreshServerStatus();
    if (status.available) {
      connectNotion("live");
      patchConnection({ mode: "live", workspaceName: status.workspaceName ?? connection.workspaceName, workspaceIcon: "◼️", step: 2 });
    } else {
      connectNotion("demo");
      patchConnection({ mode: "demo", step: 2 });
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    patchConnection({ selectedDatabaseIds: selected });
    await syncNotion("both");
    setSyncing(false);
    patchConnection({ step: 5 });
  };

return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Knowledge Layer"
        title="Notion Connection Wizard"
        description="NEXUS uses Notion as its durable operational data layer — real API integration when credentials are configured, with a clearly labelled demo fallback."
        action={connection.mode === "live" ? <BadgeTone tone="ok">LIVE NOTION CONNECTION</BadgeTone> : <DemoTag label="DEMO DATA" />}
      />

      <div className="flex flex-wrap gap-1.5">
        {STEPS.map((s) => (
          <button
            key={s.n}
            onClick={() => goStep(s.n)}
            className={cn(
              "focus-ring flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-medium transition-all",
              step === s.n ? "border-sky-400/40 bg-sky-500/12 text-sky-100" : step > s.n ? "border-emerald-400/25 bg-emerald-500/8 text-emerald-200" : "border-white/10 bg-white/4 text-slate-400",
            )}
          >
            <span className={cn("grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold", step > s.n ? "bg-emerald-500/30 text-emerald-200" : step === s.n ? "bg-sky-500/30 text-sky-100" : "bg-white/8 text-slate-400")}>
              {step > s.n ? "✓" : s.n}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title={`Step ${step} · ${STEPS[step - 1].label}`}
            icon={<Plug size={14} />}
            action={
              <div className="flex items-center gap-2">
                <StatusDot tone={liveReady ? "ok" : connection.mode === "demo" ? "warn" : "neutral"} />
                <span className="text-[11px] text-slate-400">
                  {connection.checking ? "checking…" : liveReady ? "server proxy verified" : connection.mode === "demo" ? "demo session" : "not connected"}
                </span>
              </div>
            }
          />

          <div className="space-y-4 p-4">
            {step === 1 ? (
              <ConnectStep
                live={liveReady}
                checking={connection.checking}
                reason={serverStatus.reason}
                workspace={connection.workspaceName}
                onConnect={handleConnect}
                onRetry={() => void refreshServerStatus()}
              />
            ) : null}

            {step === 2 ? (
              <PageStep
                live={liveReady}
                workspace={connection.workspaceName}
                current={connection.parentPageId}
                onSelect={(id, name) => patchConnection({ parentPageId: id, parentPageName: name })}
              />
            ) : null}

            {step === 3 ? (
              <DatabaseStep
                selected={selected}
                counts={counts}
                onToggle={(key) => setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))}
                onAll={() => setSelected(NOTION_DATABASES.map((d) => d.key))}
              />
            ) : null}

            {step === 4 ? <SyncStep syncing={syncing} onSync={handleSync} live={liveReady} mode={connection.mode} /> : null}

            {step === 5 ? (
              <VerifyStep sync={sync} live={liveReady} onOpenSync={() => navigate("/sync")} onRestart={() => { disconnectNotion(); goStep(1); }} />
            ) : null}

            <div className="flex items-center justify-between border-t border-white/8 pt-3">
              <Button variant="ghost" size="sm" disabled={step === 1} onClick={() => goStep((step - 1) as 1)}>
                <ArrowLeft size={13} /> Back
              </Button>
              {step < 5 ? (
                <Button variant="outline" size="sm" onClick={() => goStep((step + 1) as 5)}>
                  Next <ArrowRight size={13} />
                </Button>
              ) : (
                <BadgeTone tone="ok"><CheckCircle2 size={11} /> setup complete</BadgeTone>
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Security" subtitle="How the token is handled" icon={<Server size={14} />} />
          <div className="space-y-3 p-4">
            <Notice tone="ok" title="Server-side only">
              The Notion token is read by the server proxy from <code className="text-emerald-200">NOTION_TOKEN</code> and is never
              sent to the browser or inlined into the bundle.
            </Notice>
            <div className="space-y-1.5">
              {NOTION_ENV_KEYS.map((k) => (
                <div key={k.key} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/3 px-2.5 py-1.5">
                  <code className="text-[11px] text-slate-300">{k.key}</code>
                  <BadgeTone tone={k.secret ? "bad" : "neutral"}>{k.secret ? "secret" : "optional"}</BadgeTone>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Create a Notion internal integration, share the target page with it, then set these variables in the server
              environment before starting the dev server.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------ step 1 -------------------------------- */

function ConnectStep({
  live, checking, reason, workspace, onConnect, onRetry,
}: {
  live: boolean;
  checking: boolean;
  reason?: string;
  workspace: string;
  onConnect: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/3 p-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/12 bg-white/6 text-lg">◻️</span>
          <div>
            <div className="text-sm text-slate-200">{live ? workspace : "Kinetex Ops (Demo Workspace)"}</div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <StatusDot tone={live ? "ok" : "warn"} />
              {live ? "Server proxy verified · live mode available" : "No server credentials detected"}
            </div>
          </div>
        </div>
        <BadgeTone tone={live ? "ok" : "warn"}>{live ? "LIVE AVAILABLE" : "DEMO FALLBACK"}</BadgeTone>
      </div>

      {!live ? (
        <Notice tone="warn" title="Live Notion is not configured">
          {reason ?? "NOTION_TOKEN is not set on the server."} You can still complete the wizard in demo mode — the flow, databases,
          relations and sync accounting are identical, but the data source is labelled <strong>DEMO DATA</strong> and is never
          presented as live synchronization.
        </Notice>
      ) : (
        <Notice tone="ok" title="Live connection detected">
          The server has a valid Notion token. Connecting will switch NEXUS to <strong>LIVE NOTION DATA</strong> and enable real
          database creation, push and pull.
        </Notice>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant={live ? "primary" : "ai"} onClick={onConnect} disabled={checking}>
          {checking ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
          {live ? "Connect Notion (Live)" : "Connect Notion (Demo)"}
        </Button>
        <Button variant="ghost" onClick={onRetry} disabled={checking}>
          <RefreshCw size={13} className={checking ? "animate-spin" : ""} /> Re-check server
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------ step 2 -------------------------------- */

function PageStep({
  live, workspace, current, onSelect,
}: {
  live: boolean;
  workspace: string;
  current: string;
  onSelect: (id: string, name: string) => void;
}) {
  const [pages, setPages] = useState<{ id: string; title: string; icon?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!live) {
      setPages([{ id: "demo-page", title: `${workspace} · Operations Hub`, icon: "◻️" }]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPages(await listNotionPages());
      if (!pages.length) { /* keep previous */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not list pages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">
        {live
          ? "Pages the integration has been shared with. Pick the parent page NEXUS should create its databases under."
          : "Demo mode uses a simulated workspace page. Connect live Notion to list your real pages."}
      </p>
      {error ? <ErrorBlock title="Could not load pages" message={error} onRetry={load} retrying={loading} /> : null}
      {loading ? <LoadingBlock label="Listing pages…" rows={3} /> : null}
      <div className="space-y-2">
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id, p.title)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
              current === p.id ? "border-sky-400/40 bg-sky-500/10" : "border-white/8 bg-white/3 hover:bg-white/6",
            )}
          >
            <span className="text-lg">{p.icon ?? "▫️"}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{p.title}</span>
            {current === p.id ? <Check size={15} className="text-sky-300" /> : null}
          </button>
        ))}
        {!loading && pages.length === 0 && !error ? <EmptyState title="No shared pages found" hint="Share a page with your Notion integration, then retry." /> : null}
      </div>
    </div>
  );
}

/* ------------------------------ step 3 -------------------------------- */

function DatabaseStep({
  selected, counts, onToggle, onAll,
}: {
  selected: string[];
  counts: Record<string, number>;
  onToggle: (key: string) => void;
  onAll: () => void;
}) {
  const { connection } = useNexus();
  const [provisioning, setProvisioning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const provision = async () => {
    setProvisioning(true);
    setResult(null);
    try {
      const res = await provisionNotionDatabases({ parentPageId: connection.parentPageId || "demo-page", databases: selected });
      setResult(
        res.ok
          ? `Created ${res.databases.filter((d) => d.created).length} database(s) in Notion.`
          : res.message ?? "Live provisioning is unavailable — databases will be mapped in demo mode.",
      );
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Provisioning failed.");
    } finally {
      setProvisioning(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">
          NEXUS creates or maps these databases. Relations preserve the operational graph (Session → Event/Venue/Speaker/Team, Task → Owner/Session, Volunteer → Team/Assignments).
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onAll}>
            Select all
          </Button>
          <Button size="sm" variant="outline" onClick={provision} disabled={provisioning}>
            {provisioning ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />} Create / map
          </Button>
        </div>
      </div>

      {result ? <Notice tone={result.startsWith("Created") ? "ok" : "warn"}>{result}</Notice> : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {NOTION_DATABASES.map((db) => {
          const on = selected.includes(db.key);
          const relations = db.properties.filter((p) => p.type === "relation").length;
          return (
            <button
              key={db.key}
              onClick={() => onToggle(db.key)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                on ? "border-emerald-400/30 bg-emerald-500/8" : "border-white/8 bg-white/3 hover:bg-white/6",
              )}
            >
              <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px]", on ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200" : "border-white/15 text-transparent")}>✓</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium text-slate-200">
                  <span>{db.icon}</span> {db.name.replace("NEXUS ", "")}
                </span>
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  {counts[db.key] ?? 0} rows · {relations} relation{relations === 1 ? "" : "s"} · entity {db.mappedEntity}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Sparkles size={11} className="text-violet-300" />
        {selected.length} of {NOTION_DATABASES.length} databases selected.
      </div>
    </div>
  );
}

/* ------------------------------ step 4 -------------------------------- */

function SyncStep({ syncing, onSync, live, mode }: { syncing: boolean; onSync: () => void; live: boolean; mode: string }) {
  return (
    <div className="space-y-4">
      <Notice tone={live ? "ok" : "warn"} title={live ? "Live synchronization" : "Simulated synchronization (DEMO DATA)"}>
        {live
          ? "NEXUS will push mapped rows to Notion, then pull edits made inside Notion and reconcile them locally."
          : "This is a deterministic simulation of the same two-way workflow. It is labelled DEMO DATA and is not live Notion synchronization."}
      </Notice>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatChip label="Direction" value="↔ two-way" tone="blue" />
        <StatChip label="Mode" value={mode === "live" ? "LIVE" : "DEMO"} tone={mode === "live" ? "ok" : "warn"} />
        <StatChip label="Databases" value={String(NOTION_DATABASES.length)} tone="neutral" />
        <StatChip label="Status" value={syncing ? "syncing" : "ready"} tone={syncing ? "warn" : "ok"} />
      </div>

      <Button variant="ai" onClick={onSync} disabled={syncing}>
        {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {syncing ? "Syncing…" : "Run two-way sync"}
      </Button>

      {syncing ? <LoadingBlock label="Pushing local changes, then pulling Notion edits…" rows={3} /> : null}
    </div>
  );
}

/* ------------------------------ step 5 -------------------------------- */

function VerifyStep({
  sync, live, onOpenSync, onRestart,
}: {
  sync: ReturnType<typeof useNexus>["sync"];
  live: boolean;
  onOpenSync: () => void;
  onRestart: () => void;
}) {
  const ok = sync.stats.recordsSynced > 0 && sync.stats.failed === 0;
  return (
    <div className="space-y-4">
      <div className={cn("flex flex-wrap items-center gap-3 rounded-xl border p-3", ok ? "border-emerald-400/25 bg-emerald-500/8" : "border-amber-400/25 bg-amber-500/8")}>
        {ok ? <CheckCircle2 size={20} className="text-emerald-300" /> : <RefreshCw size={18} className="text-amber-300" />}
        <div>
          <div className="text-sm font-semibold text-slate-100">{ok ? "Verification passed" : "Sync not run yet"}</div>
          <div className="text-[11px] text-slate-400">
            {ok
              ? `${sync.stats.recordsSynced} records verified across ${sync.databases.length} databases · health ${sync.health.toUpperCase()}`
              : "Return to Step 4 and run the two-way sync to verify the connection."}
          </div>
        </div>
        <BadgeTone tone={live ? "ok" : "warn"} className="ml-auto">{live ? "LIVE" : "DEMO"}</BadgeTone>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="Synced" value={sync.stats.recordsSynced} tone="ok" />
        <StatChip label="Created" value={sync.stats.created} tone="blue" />
        <StatChip label="Updated" value={sync.stats.updated} tone="ai" />
        <StatChip label="Failed" value={sync.stats.failed} tone={sync.stats.failed ? "bad" : "neutral"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={onOpenSync}>
          <ExternalLink size={13} /> Open Sync Center
        </Button>
        <Button variant="ghost" onClick={onRestart}>
          <RefreshCw size={13} /> Re-run wizard
        </Button>
      </div>
    </div>
  );
}