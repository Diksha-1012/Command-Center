import { useNavigate } from "react-router-dom";
import { Activity, AlertTriangle, Check, GitBranch, RefreshCw, Siren, Sparkles, Wand2 } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { BadgeTone, Panel, PanelHeader, SectionTitle, StatusDot } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { ActivityKind } from "@/types";

const KIND_META: Record<ActivityKind, { icon: typeof Activity; tone: "bad" | "warn" | "blue" | "ai" | "ok" | "neutral"; label: string }> = {
  change: { icon: GitBranch, tone: "blue", label: "change" },
  impact: { icon: Activity, tone: "ai", label: "impact analysis" },
  detection: { icon: AlertTriangle, tone: "warn", label: "detection" },
  recommendation: { icon: Wand2, tone: "ai", label: "recommendation" },
  approval: { icon: Check, tone: "ok", label: "approval" },
  sync: { icon: RefreshCw, tone: "neutral", label: "sync" },
  incident: { icon: Siren, tone: "bad", label: "incident" },
  alert: { icon: Sparkles, tone: "blue", label: "notice" },
};

const ROUTE_FOR_KIND: Record<string, string> = {
  task: "/tasks",
  session: "/schedule",
  volunteer: "/volunteers",
  resource: "/resources",
  venue: "/events",
  incident: "/incidents",
  team: "/teams",
  speaker: "/schedule",
  communication: "/knowledge",
};

export function Timeline() {
  const { data } = useNexus();
  const navigate = useNavigate();

  const events = [...data.activity].sort((a, b) => (a.at < b.at ? 1 : -1));

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Audit Trail"
        title="Event Timeline"
        description="Every change, detection and approval in one chronological stream. Applying a simulation writes its full trace here."
        action={<BadgeTone tone="ai">{events.length} events</BadgeTone>}
      />

      <div className="grid gap-5 lg:grid-cols-4">
        <Panel className="lg:col-span-3">
          <PanelHeader title="Activity Stream" subtitle="Latest first · all timestamps in event-local time" icon={<Activity size={14} />} />
          <div className="p-4">
            <ol className="relative space-y-3 border-l border-white/8 pl-5">
              {events.map((e) => {
                const meta = KIND_META[e.kind];
                const Icon = meta.icon;
                return (
                  <li key={e.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[27px] top-1 grid h-5 w-5 place-items-center rounded-full border",
                        meta.tone === "bad" ? "border-rose-400/30 bg-rose-500/15 text-rose-300"
                          : meta.tone === "warn" ? "border-amber-400/30 bg-amber-500/15 text-amber-300"
                            : meta.tone === "ai" ? "border-violet-400/30 bg-violet-500/15 text-violet-300"
                              : meta.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                                : "border-white/12 bg-white/5 text-slate-400",
                      )}
                    >
                      <Icon size={11} />
                    </span>
                    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-slate-500">{e.at.slice(11, 16)}</span>
                        <span className="text-xs font-medium text-slate-100">{e.title}</span>
                        <BadgeTone tone={meta.tone}>{meta.label}</BadgeTone>
                      </div>
                      {e.detail ? <p className="mt-1 text-[11px] text-slate-400">{e.detail}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {e.actor ? <span className="text-[10px] text-slate-500">{e.actor}</span> : null}
                        {e.related?.map((r) => (
                          <button
                            key={`${r.kind}-${r.id}`}
                            onClick={() => navigate(ROUTE_FOR_KIND[r.kind] ?? "/command")}
                            className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-slate-200"
                          >
                            {r.kind}: {r.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </li>
                );
              })}
              {events.length === 0 ? <li className="text-sm text-slate-500">No activity recorded yet.</li> : null}
            </ol>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Stream Composition" subtitle="By event type" icon={<GitBranch size={14} />} />
            <div className="space-y-2 p-4">
              {(Object.keys(KIND_META) as ActivityKind[]).map((kind) => {
                const count = data.activity.filter((a) => a.kind === kind).length;
                if (count === 0) return null;
                const meta = KIND_META[kind];
                return (
                  <div key={kind} className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/3 px-3 py-2">
                    <StatusDot tone={meta.tone === "ai" ? "ai" : meta.tone === "ok" ? "ok" : meta.tone === "bad" ? "bad" : meta.tone === "warn" ? "warn" : "neutral"} />
                    <span className="text-xs text-slate-300">{meta.label}</span>
                    <span className="ml-auto font-mono text-xs text-slate-400">{count}</span>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Audit Guarantee" subtitle="What this stream is for" icon={<Check size={14} />} />
            <div className="space-y-2 p-4 text-[11px] leading-relaxed text-slate-400">
              <p>
                Every applied simulation writes five linked entries: the approval, the impact analysis, the risks
                detected, the recommended actions and the Notion sync queue.
              </p>
              <p>
                Assignments and workload rebalances are recorded with their reasoning, so any operational decision can be
                traced back to the data it was based on.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
