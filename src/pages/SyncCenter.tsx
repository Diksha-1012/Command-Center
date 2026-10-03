import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Database, RefreshCw, Server, Sparkles } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { BadgeTone, Button, Panel, PanelHeader, SectionTitle, StatusDot } from "@/components/ui/primitives";
import { ErrorBlock, LoadingBlock, Notice, StatChip } from "@/components/ui/StateBlocks";
import { relativeFromNow } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * NOTION SYNC CENTER (Part 3)
 * Shows the connected workspace, last sync, per-database counts and every
 * recent operation in both directions. Fails soft: if Notion is unavailable it
 * says so and confirms local operational state is preserved.
 */

export function SyncCenter() {
  const { connection, serverStatus, sync, syncNotion, refreshServerStatus } = useNexus();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"both" | "push" | "pull" | null>(null);

  useEffect(() => {
    void refreshServerStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (direction: "both" | "push" | "pull") => {
    setBusy(direction);
    await syncNotion(direction);
    setBusy(null);
  };

  const live = connection.mode === "live" && serverStatus.available;
  const lastSync = sync.lastSyncAt ? relativeFromNow(sync.lastSyncAt, new Date().toISOString()) : "never";

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Knowledge Layer"
        title="Notion Sync Center"
        description="Two-way synchronization between NEXUS operational records and the Notion knowledge layer."
        action={live ? <BadgeTone tone="ok">NOTION CONNECTED</BadgeTone> : <BadgeTone tone="warn">NOTION NOT CONNECTED</BadgeTone>}
      />

      {!live ? (
        <ErrorBlock
          title="NOTION NOT CONNECTED"
          message={
            sync.error ??
            serverStatus.reason ??
            "No Notion credentials are configured. Nothing has been — and nothing will be — synchronized to Notion until a token is set on the server. Your local operational data is preserved."
          }
          onRetry={() => void refreshServerStatus()}
          retrying={connection.checking}
        />
      ) : sync.status === "error" ? (
        <ErrorBlock
          title="Notion sync failed"
          message={sync.error ?? "The Notion API reported an error. Local operational state is preserved."}
          onRetry={() => void run("both")}
          retrying={!!busy}
        />
      ) : null}

<div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Connection"
            subtitle="Workspace, identity and health"
            icon={<Server size={14} />}
            action={
              <div className="flex items-center gap-2">
                <StatusDot tone={sync.health === "healthy" ? "ok" : sync.health === "warning" ? "warn" : "bad"} />
                <span className={cn("text-[11px] font-semibold uppercase tracking-wide", !live ? "text-amber-300" : sync.health === "healthy" ? "text-emerald-300" : sync.health === "warning" ? "text-amber-300" : "text-rose-300")}>
                  {!live ? "NOT CONNECTED" : sync.status === "idle" ? "AWAITING FIRST SYNC" : sync.health.toUpperCase()}
                </span>
              </div>
            }
          />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Connected workspace</div>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-200">
                <span>{live ? connection.workspaceIcon : "⛔"}</span>
                {live ? serverStatus.workspaceName ?? connection.workspaceName : "NOTION NOT CONNECTED"}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {live ? `integration: ${serverStatus.botName ?? "NEXUS"}` : "no credentials configured · no sync will occur"}
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Last sync</div>
              <div className="mt-1 font-mono text-sm text-slate-200">{lastSync}</div>
              <div className="mt-1 text-[10px] text-slate-500">{sync.lastSyncAt ?? "no sync recorded yet"}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-4 pb-4">
            <Button size="sm" variant="ai" onClick={() => run("both")} disabled={!!busy} title={live ? undefined : "Notion is not connected — this runs a local preview only"}>
              {busy === "both" ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />} {live ? "Sync both directions" : "Preview sync (not connected)"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => run("push")} disabled={!!busy}>
              {busy === "push" ? <RefreshCw size={13} className="animate-spin" /> : <ArrowUpRight size={13} />} Push app → Notion
            </Button>
            <Button size="sm" variant="outline" onClick={() => run("pull")} disabled={!!busy}>
              {busy === "pull" ? <RefreshCw size={13} className="animate-spin" /> : <ArrowDownLeft size={13} />} Pull Notion → app
            </Button>
            <Button size="sm" variant="ghost" onClick={() => navigate("/notion")}>
              Reconfigure <Database size={13} />
            </Button>
          </div>

          {busy ? <div className="px-4 pb-4"><LoadingBlock label="Reconciling records…" rows={2} /></div> : null}
        </Panel>

        <Panel>
          <PanelHeader title="Sync totals" subtitle="Since the last successful run" icon={<CheckCircle2 size={14} />} />
          <div className="grid grid-cols-2 gap-2 p-4">
            <StatChip label="Records synced" value={sync.stats.recordsSynced} tone="ok" />
            <StatChip label="Created" value={sync.stats.created} tone="blue" />
            <StatChip label="Updated" value={sync.stats.updated} tone="ai" />
            <StatChip label="Failed" value={sync.stats.failed} tone={sync.stats.failed ? "bad" : "neutral"} />
            <StatChip label="Pending" value={sync.stats.pending} tone="neutral" />
            <StatChip label="Databases" value={sync.databases.length} tone="neutral" />
          </div>            <div className="px-4 pb-4">
            <Notice tone={live ? "ok" : "warn"} title={live ? "LIVE NOTION DATA" : "NOTION NOT CONNECTED"}>
              {live
                ? "Counts reflect real push/pull operations against the Notion API."
                : "No Notion credentials are configured, so nothing is synchronized. The counts below are a local preview only — NEXUS never presents them as a real sync."}
            </Notice>
          </div>
        </Panel>
      </div>

<Panel>
        <PanelHeader title="Databases" subtitle="Per-database synchronization state" icon={<Database size={14} />} />
        <div className="overflow-x-auto p-4">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                <th className="pb-2 font-semibold">Database</th>
                <th className="pb-2 font-semibold">Entity</th>
                <th className="pb-2 text-right font-semibold">Rows</th>
                <th className="pb-2 text-right font-semibold">Synced</th>
                <th className="pb-2 text-right font-semibold">Failed</th>
                <th className="pb-2 text-right font-semibold">Last sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {sync.databases.map((db) => (
                <tr key={db.id} className="text-slate-300">
                  <td className="py-2">
                    <span className="inline-flex items-center gap-2">
                      <span>{db.icon}</span> {db.name.replace("NEXUS ", "")}
                    </span>
                  </td>
                  <td className="py-2 text-slate-500">{db.mappedEntity}</td>
                  <td className="py-2 text-right font-mono">{db.rows}</td>
                  <td className="py-2 text-right font-mono text-emerald-300">{db.synced}</td>
                  <td className={cn("py-2 text-right font-mono", db.failed ? "text-rose-300" : "text-slate-500")}>{db.failed}</td>
                  <td className="py-2 text-right text-[11px] text-slate-500">
                    {db.lastSyncedAt ? relativeFromNow(db.lastSyncedAt, new Date().toISOString()) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sync.databases.every((d) => d.synced === 0) ? (
            <p className="pt-3 text-center text-[11px] text-slate-500">No databases synced yet — run a sync to populate counts.</p>
          ) : null}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Recent operations" subtitle="Newest first, both directions" icon={<RefreshCw size={14} />} />
          <div className="space-y-1.5 p-4">
            {sync.recentOps.slice(0, 14).map((op) => (
              <div key={op.id} className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-white/3 p-2.5">
                <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border", op.direction === "app_to_notion" ? "border-sky-400/25 bg-sky-500/12 text-sky-300" : "border-violet-400/25 bg-violet-500/12 text-violet-300")}>
                  {op.direction === "app_to_notion" ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-xs text-slate-200">{op.entityLabel || op.entityId}</span>
                    <BadgeTone tone={op.op === "create" ? "ok" : op.op === "conflict" ? "bad" : "blue"}>{op.op}</BadgeTone>
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {op.database} · {op.direction === "app_to_notion" ? "app → notion" : "notion → app"} · {op.fields.join(", ")}
                  </div>
                </div>
              </div>
            ))}
            {sync.recentOps.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No operations recorded yet.</p> : null}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Sync log" subtitle="Diagnostics" icon={<Server size={14} />} />
          <div className="space-y-1.5 p-4">
            {sync.log.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-white/8 bg-white/3 p-2">
                <div className="flex items-center gap-1.5">
                  <StatusDot tone={entry.level === "error" ? "bad" : entry.level === "warn" ? "warn" : "ok"} />
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wide", entry.level === "error" ? "text-rose-300" : entry.level === "warn" ? "text-amber-300" : "text-emerald-300")}>
                    {entry.level}
                  </span>
                  <span className="ml-auto text-[10px] text-slate-500">{entry.at.slice(11, 19)}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">{entry.message}</p>
              </div>
            ))}
            {sync.log.length === 0 ? <p className="py-6 text-center text-xs text-slate-500">No log entries yet.</p> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}