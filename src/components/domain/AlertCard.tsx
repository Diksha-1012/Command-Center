import { AlertTriangle, Info, ShieldAlert, Check } from "lucide-react";
import type { Alert } from "@/types";
import { cn } from "@/lib/cn";
import { relativeFromNow } from "@/lib/format";
import { NOW } from "@/data/seed";
import { Button } from "@/components/ui/primitives";

const SEV = {
  critical: { icon: ShieldAlert, ring: "border-l-rose-400", chip: "bg-rose-500/15 text-rose-300 border-rose-400/30", glow: "from-rose-500/10" },
  warning: { icon: AlertTriangle, ring: "border-l-amber-400", chip: "bg-amber-500/15 text-amber-300 border-amber-400/30", glow: "from-amber-500/10" },
  info: { icon: Info, ring: "border-l-sky-400", chip: "bg-sky-500/15 text-sky-300 border-sky-400/30", glow: "from-sky-500/10" },
} as const;

export function AlertCard({
  alert,
  onAcknowledge,
  onInspect,
  compact,
}: {
  alert: Alert;
  onAcknowledge: (id: string) => void;
  onInspect?: (alert: Alert) => void;
  compact?: boolean;
}) {
  const sev = SEV[alert.severity];
  const Icon = sev.icon;
  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-white/8 border-l-2 bg-white/3 p-3 transition-colors hover:bg-white/5", sev.ring, alert.acknowledged && "opacity-55")}>
      <div className={cn("pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r to-transparent", sev.glow)} />
      <div className="relative flex items-start gap-2.5">
        <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border", sev.chip)}>
          <Icon size={13} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-bold tracking-wide", sev.chip)}>{alert.severity.toUpperCase()}</span>
            <span className="text-sm font-medium text-slate-100">{alert.title}</span>
            {alert.acknowledged ? <span className="text-[10px] uppercase tracking-wide text-slate-500">acknowledged</span> : null}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{alert.description}</p>
          {!compact ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5">
                {alert.related.kind}: {alert.related.label}
              </span>
              <span>{relativeFromNow(alert.timestamp, NOW)}</span>
            </div>
          ) : null}
          {!compact ? (
            <div className="mt-2 rounded-lg border border-violet-400/15 bg-violet-500/6 px-2.5 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">Suggested action</span>
              <p className="mt-0.5 text-[11px] text-slate-300">{alert.suggestedAction}</p>
            </div>
          ) : null}
          <div className="mt-2 flex items-center gap-2">
            {!alert.acknowledged ? (
              <Button size="sm" variant="ghost" onClick={() => onAcknowledge(alert.id)}>
                <Check size={13} /> Acknowledge
              </Button>
            ) : null}
            {onInspect ? (
              <Button size="sm" variant="ghost" onClick={() => onInspect(alert)}>
                Inspect
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
