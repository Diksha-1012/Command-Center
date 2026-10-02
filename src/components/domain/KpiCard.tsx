import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/primitives";

export function KpiCard({
  label,
  value,
  sub,
  icon,
  tone = "blue",
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: "ok" | "warn" | "bad" | "ai" | "blue" | "neutral";
  accent?: ReactNode;
}) {
  const toneRing: Record<string, string> = {
    ok: "text-emerald-300 bg-emerald-500/12 border-emerald-400/25",
    warn: "text-amber-300 bg-amber-500/12 border-amber-400/25",
    bad: "text-rose-300 bg-rose-500/12 border-rose-400/25",
    ai: "text-violet-300 bg-violet-500/12 border-violet-400/25",
    blue: "text-sky-300 bg-sky-500/12 border-sky-400/25",
    neutral: "text-slate-300 bg-white/6 border-white/12",
  };
  return (
    <Panel className="group relative overflow-hidden p-4 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold leading-none text-slate-50">{value}</div>
          {sub ? <div className="mt-1.5 text-[11px] text-slate-400">{sub}</div> : null}
        </div>
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl border", toneRing[tone])}>{icon}</span>
      </div>
      {accent ? <div className="mt-3">{accent}</div> : null}
      <div className={cn("pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl opacity-0 transition-opacity group-hover:opacity-100", tone === "bad" ? "bg-rose-500/20" : tone === "warn" ? "bg-amber-500/20" : tone === "ai" ? "bg-violet-500/20" : "bg-sky-500/20")} />
    </Panel>
  );
}
