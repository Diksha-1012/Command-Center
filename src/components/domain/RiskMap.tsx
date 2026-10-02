import { useState } from "react";
import { ChevronDown, HelpCircle, ShieldAlert, ShieldCheck, ShieldHalf } from "lucide-react";
import type { EntityRef, RiskLevel } from "@/types";
import { cn } from "@/lib/cn";
import { BadgeTone } from "@/components/ui/primitives";
import { KIND_LABEL } from "@/lib/dependencyEngine";
import { RISK_RANK, type RiskReport } from "@/lib/riskEngine";

/**
 * LIVE RISK MAP
 * Three lanes: CRITICAL · AT RISK · HEALTHY.
 * Every card expands to answer "WHY?" using deterministic rule findings.
 */

const LANES = [
  { id: "critical", label: "Critical", levels: ["critical"], icon: ShieldAlert, ring: "border-rose-400/25", chip: "bad" as const },
  { id: "atrisk", label: "At risk", levels: ["high", "medium"], icon: ShieldHalf, ring: "border-amber-400/25", chip: "warn" as const },
  { id: "healthy", label: "Healthy", levels: ["low", "none"], icon: ShieldCheck, ring: "border-emerald-400/25", chip: "ok" as const },
];

export function RiskMap({ risk }: { risk: RiskReport }) {
  const [open, setOpen] = useState<string | null>(null);

  // Group every evaluated node by its worst risk level.
  const lanes = LANES.map((lane) => {
    const nodes = Object.entries(risk.findingsByNode)
      .filter(([key]) => {
        const level = risk.byNode[key] ?? "none";
        return lane.levels.includes(level);
      })
      .map(([key, findings]) => ({ key, findings, level: (risk.byNode[key] ?? "none") as RiskLevel }))
      .sort((a, b) => RISK_RANK[b.level] - RISK_RANK[a.level]);
    return { ...lane, nodes };
  });

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {lanes.map((lane) => {
        const Icon = lane.icon;
        return (
          <div key={lane.id} className={cn("rounded-2xl border bg-white/2 p-3", lane.ring)}>
            <div className="mb-3 flex items-center gap-2">
              <Icon size={14} className={lane.chip === "bad" ? "text-rose-300" : lane.chip === "warn" ? "text-amber-300" : "text-emerald-300"} />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">{lane.label}</span>
              <span className="ml-auto rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{lane.nodes.length}</span>
            </div>
            <div className="space-y-2">
              {lane.nodes.slice(0, 10).map(({ key, findings, level }) => {
                const node = riskNodeLabel(key, findings);
                const isOpen = open === key;
                return (
                  <div key={key} className="rounded-xl border border-white/8 bg-white/3">
                    <button
                      onClick={() => setOpen(isOpen ? null : key)}
                      className="flex w-full items-start gap-2 p-2.5 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-200">{node.label}</span>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-500">
                          {KIND_LABEL[node.kind] ?? node.kind} · {findings.length} finding{findings.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      <BadgeTone tone={level === "critical" ? "bad" : level === "high" ? "warn" : level === "medium" ? "warn" : "ok"}>
                        {level}
                      </BadgeTone>
                      <ChevronDown size={13} className={cn("mt-0.5 text-slate-500 transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen ? (
                      <div className="border-t border-white/8 px-2.5 py-2">
                        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                          <HelpCircle size={10} /> Why this is at risk
                        </div>
                        <ul className="space-y-1.5">
                          {findings.map((f) => (
                            <li key={f.id} className="text-[11px] leading-snug text-slate-400">
                              <span className="mr-1 font-mono text-[10px] text-slate-600">{f.rule}</span>
                              {f.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {lane.nodes.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-slate-600">
                  {lane.id === "healthy" ? "No unqualified records in this lane" : "Nothing in this lane"}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function riskNodeLabel(key: string, findings: { ref?: EntityRef; related: EntityRef[] }[]): { label: string; kind: string } {
  const first = findings[0];
  const ref = first?.ref ?? first?.related[0];
  if (ref) return { label: ref.label, kind: ref.kind };
  return { label: key.split(":")[1] ?? key, kind: key.split(":")[0] ?? "unknown" };
}
