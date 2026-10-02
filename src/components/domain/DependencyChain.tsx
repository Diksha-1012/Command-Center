import { ArrowRight, Boxes, CalendarDays, Radio, Server, Siren, Users2, Wrench } from "lucide-react";
import type { ImpactAnalysis, ImpactNode } from "@/types";
import { cn } from "@/lib/cn";
import { BadgeTone } from "@/components/ui/primitives";

const KIND_META: Record<string, { icon: typeof CalendarDays; label: string; tone: "ok" | "warn" | "bad" | "ai" | "blue" | "neutral" }> = {
  session: { icon: CalendarDays, label: "Sessions", tone: "blue" },
  volunteer: { icon: Users2, label: "Volunteers", tone: "warn" },
  resource: { icon: Boxes, label: "Equipment", tone: "bad" },
  task: { icon: Wrench, label: "Tasks", tone: "neutral" },
  communication: { icon: Radio, label: "Communications", tone: "ai" },
  speaker: { icon: Users2, label: "Speakers", tone: "blue" },
  team: { icon: Users2, label: "Teams", tone: "neutral" },
  venue: { icon: Server, label: "Venues", tone: "ok" },
  incident: { icon: Siren, label: "Incidents", tone: "bad" },
};

const sevRing: Record<string, string> = {
  critical: "border-l-rose-400 bg-rose-500/6",
  warning: "border-l-amber-400 bg-amber-500/6",
  info: "border-l-sky-400 bg-sky-500/6",
};

const BANDS = [
  { key: "direct", label: "Direct impact", hint: "1 hop", ring: "border-rose-400/25" },
  { key: "indirect", label: "Indirect impact", hint: "2–3 hops", ring: "border-amber-400/25" },
  { key: "potential", label: "Potential impact", hint: "4+ hops · watch list", ring: "border-sky-400/25" },
] as const;

export function DependencyChain({ analysis }: { analysis: ImpactAnalysis }) {
  const bands = {
    direct: analysis.direct,
    indirect: analysis.indirect,
    potential: analysis.potential,
  };

  return (
    <div className="space-y-4">
      {/* Origin */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div
          className={cn(
            "sm:w-64 shrink-0 rounded-2xl border p-4 ai-glow",
            analysis.impactLevel === "critical"
              ? "border-rose-400/35 bg-gradient-to-br from-rose-500/16 to-rose-500/6"
              : "border-violet-400/30 bg-gradient-to-br from-violet-500/16 to-sky-500/8",
          )}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Change origin</div>
          <div className="mt-1 text-sm font-semibold text-slate-50">{analysis.source.label}</div>
          <div className="mt-1 text-[11px] text-slate-400">{analysis.change}</div>
          <div className="mt-3 flex items-end gap-2">
            <span className="font-mono text-3xl font-semibold text-slate-50">{analysis.impactScore}</span>
            <span className="pb-1 text-xs text-slate-400">/ 100</span>
          </div>
          <div className="mt-1">
            <BadgeTone tone={analysis.impactLevel === "critical" ? "bad" : analysis.impactLevel === "high" ? "warn" : "blue"}>
              {analysis.impactLevel.toUpperCase()} IMPACT
            </BadgeTone>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-300" />
            {analysis.totalAffected} downstream items
          </div>
        </div>

        <div className="hidden items-center px-1 text-slate-600 sm:flex">
          <ArrowRight size={18} />
        </div>

        {/* Kind breakdown */}
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {analysis.byKind.map((k) => {
            const meta = KIND_META[k.kind] ?? KIND_META.task;
            const Icon = meta.icon;
            return (
              <div key={k.kind} className="rounded-xl border border-white/8 bg-white/3 p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
                  <Icon size={11} /> {k.label}
                </div>
                <div className="mt-1 font-mono text-xl text-slate-100">{k.count}</div>
              </div>
            );
          })}
          {analysis.byKind.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-white/12 p-4 text-sm text-slate-400">
              No downstream dependencies found for this entity in the graph.
            </div>
          ) : null}
        </div>
      </div>

      {/* Bands */}
      {BANDS.map((band) => {
        const nodes = bands[band.key];
        if (nodes.length === 0) return null;
        return (
          <div key={band.key} className={cn("rounded-2xl border bg-white/2 p-3", band.ring)}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">{band.label}</span>
              <span className="text-[10px] text-slate-500">{band.hint}</span>
              <span className="ml-auto rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{nodes.length}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {nodes.map((n) => (
                <ImpactCard key={`${band.key}-${n.kind}-${n.id}`} node={n} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><ArrowRight size={12} /> hop = graph distance from the changed entity</span>
        <span>· confidence decays 22% per hop</span>
      </div>
    </div>
  );
}

function ImpactCard({ node }: { node: ImpactNode }) {
  return (
    <div className={cn("rounded-xl border border-white/8 border-l-2 p-2.5", sevRing[node.severity])}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-200">{node.label}</span>
        <div className="flex shrink-0 items-center gap-1">
          <BadgeTone tone="neutral">{node.via.toLowerCase()}</BadgeTone>
          <BadgeTone tone={node.severity === "critical" ? "bad" : node.severity === "warning" ? "warn" : "blue"}>
            hop {node.depth}
          </BadgeTone>
        </div>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{node.reason}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
          <div className="h-full rounded-full bg-violet-400/70" style={{ width: `${Math.round(node.confidence * 100)}%` }} />
        </div>
        <span className="font-mono text-[10px] text-slate-500">{Math.round(node.confidence * 100)}%</span>
      </div>
    </div>
  );
}
