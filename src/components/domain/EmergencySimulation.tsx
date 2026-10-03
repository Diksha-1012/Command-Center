import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, ShieldAlert, Sparkles, X, Zap } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { runEmergencySimulation } from "@/lib/emergency";
import { BadgeTone, Button } from "@/components/ui/primitives";
import { AiBasis, VerifiedBadge } from "@/components/domain/SourceBar";
import { cn } from "@/lib/cn";

/**
 * ⚡ RUN EMERGENCY SIMULATION (Part 3) — the signature demo moment.
 * Animates the propagation chain Venue → Sessions → Speakers → Resources →
 * Volunteers → Tasks → Communications using the REAL impact engine, then routes
 * the human through REVIEW → APPLY.
 */

type Phase = "spread" | "report" | "review" | "applying" | "applied";

export function EmergencySimulation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, graph, risk, applyChangeRequests, syncNotion } = useNexus();
  const result = useMemo(() => runEmergencySimulation(data, graph, risk), [data, graph, risk]);

  const [phase, setPhase] = useState<Phase>("spread");
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open || !result) return;
    setPhase("spread");
    setStep(0);
    let i = 0;
    const timer = window.setInterval(() => {
      i += 1;
      setStep(i);
      if (i >= result.chain.length) {
        window.clearInterval(timer);
        window.setTimeout(() => setPhase("report"), 500);
      }
    }, 480);
    return () => window.clearInterval(timer);
  }, [open, result]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !result) return null;

  const apply = async () => {
    setPhase("applying");
    applyChangeRequests(result.requests, `${result.venue.label} → ${result.target.label}`);
    window.setTimeout(() => setPhase("applied"), 900);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink-950/85 p-3 backdrop-blur-md sm:p-6">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-rose-400/25 bg-ink-900/95 shadow-2xl animate-rise">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-30" />
        <header className="relative flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeTone tone="bad">
                <ShieldAlert size={11} /> EMERGENCY SIMULATION
              </BadgeTone>
              {phase === "applied" ? <BadgeTone tone="ok"><CheckCircle2 size={11} /> APPLIED</BadgeTone> : null}
            </div>
            <h2 className="mt-2 text-lg font-bold tracking-tight text-slate-50">MAIN AUDITORIUM UNAVAILABLE</h2>
            <p className="mt-0.5 text-xs text-slate-400">{result.headline}</p>
          </div>
          <button onClick={onClose} className="focus-ring rounded-lg p-1.5 text-slate-400 hover:bg-white/8 hover:text-slate-200" aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="relative px-5 py-5">
          {phase === "spread" ? <ChainPropagation result={result} step={step} /> : null}
          {phase === "report" ? <ReportView result={result} onReview={() => setPhase("review")} onClose={onClose} /> : null}
          {phase === "review" ? <ReviewView result={result} onApply={apply} onBack={() => setPhase("report")} /> : null}
          {phase === "applying" ? <ApplyingView /> : null}
          {phase === "applied" ? (
            <AppliedView
              result={result}
              onSync={async () => {
                await syncNotion("push");
                onClose();
              }}
              onClose={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

type Emergency = NonNullable<ReturnType<typeof runEmergencySimulation>>;

function ChainPropagation({ result, step }: { result: Emergency; step: number }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-400/30 bg-rose-500/15 text-rose-300">
          <Zap size={18} />
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-100">{result.venue.label}</div>
          <div className="text-[11px] text-rose-300">Unavailable — propagating through the dependency graph…</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {result.chain.map((c, i) => {
          const lit = i <= step - 1;
          const active = i === step - 1;
          return (
            <div key={c.key} className="flex items-center gap-2">
              <div
                className={cn(
                  "rounded-xl border px-3 py-2 transition-all duration-300",
                  lit ? "border-white/15 bg-white/6" : "border-white/8 bg-white/2 opacity-40",
                  active && "scale-105 ai-glow",
                )}
              >
                <div className="text-[10px] uppercase tracking-wide text-slate-500">{c.label}</div>
                <div className={cn("font-mono text-lg", lit ? "text-slate-100" : "text-slate-600")}>{lit ? c.count : "–"}</div>
              </div>
              {i < result.chain.length - 1 ? (
                <ArrowRight size={14} className={cn("transition-colors", lit ? "text-violet-300" : "text-slate-700")} />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <Sparkles size={11} className="text-violet-300" />
        Blast radius spreading — {Math.min(step, result.chain.length)}/{result.chain.length} dependency layers evaluated.
      </div>
    </div>
  );
}

function ReportView({ result, onReview, onClose }: { result: Emergency; onReview: () => void; onClose: () => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <BigStat label="Impact score" value={result.impactScore} suffix="/100" tone="bad" />
        <BigStat label="Affected items" value={result.affected} tone="warn" />
        <BigStat label="Critical" value={result.critical} tone="bad" />
        <BigStat label="Recommended actions" value={result.actions.length} tone="ai" />
      </div>

      <div className="rounded-2xl border border-violet-400/25 bg-violet-500/6 p-4">
        <AiBasis basis={["sessions", "dependencies", "tasks", "volunteers", "resources"]} />
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{result.aiExplanation}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        {result.chain.filter((c) => c.count > 0).map((c) => (
          <span key={c.key} className="rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5">
            {c.count} {c.label.toLowerCase()}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="ai" onClick={onReview}>
          Review plan <ArrowRight size={14} />
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Not now
        </Button>
      </div>
    </div>
  );
}

function ReviewView({ result, onApply, onBack }: { result: Emergency; onApply: () => void; onBack: () => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">Recommended actions</h3>
        <p className="text-[11px] text-slate-500">Nothing is written until you approve. High-impact items are listed first.</p>
      </div>
      <div className="space-y-2">
        {result.actions.map((a) => (
          <div key={a.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-medium text-slate-100">{a.title}</span>
              <BadgeTone tone={a.priority === "critical" ? "bad" : a.priority === "high" ? "warn" : "blue"}>{a.priority}</BadgeTone>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{a.detail}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {a.related.slice(0, 4).map((r) => (
                <span key={`${r.kind}-${r.id}`} className="rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {r.kind}: {r.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/8 bg-white/3 p-3">
        <div className="mb-1.5 flex items-center gap-2">
          <VerifiedBadge label="AFFECTED RECORDS" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {result.affectedRefs.slice(0, 14).map((r) => (
            <span key={`${r.kind}-${r.id}`} className="rounded-md border border-amber-400/20 bg-amber-500/8 px-1.5 py-0.5 text-[10px] text-amber-200">
              {r.kind}: {r.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={onApply}>
          <CheckCircle2 size={14} /> Apply changes
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
      <p className="text-[11px] text-amber-300/90">
        <AlertTriangle size={11} className="mr-1 inline" />
        Applying updates {result.requests.length} session record{result.requests.length === 1 ? "" : "s"} in the live demo store.
      </p>
    </div>
  );
}

function ApplyingView() {
  return (
    <div className="grid place-items-center gap-3 py-10 text-center">
      <RefreshCw size={26} className="animate-spin text-sky-300" />
      <div className="text-sm text-slate-200">Applying approved changes…</div>
      <div className="text-[11px] text-slate-500">Updating sessions, then queuing the Notion write-back.</div>
    </div>
  );
}

function AppliedView({ result, onSync, onClose }: { result: Emergency; onSync: () => void; onClose: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/8 p-4">
        <CheckCircle2 size={22} className="text-emerald-300" />
        <div>
          <div className="text-sm font-semibold text-emerald-200">Changes applied</div>
          <div className="text-[11px] text-slate-300">
            {result.requests.length} session{result.requests.length === 1 ? "" : "s"} relocated to {result.target.label} · operational state updated.
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="ai" onClick={onSync}>
          <Sparkles size={14} /> Sync to Notion
        </Button>
        <Button variant="outline" onClick={onClose}>
          Back to Command Center
        </Button>
      </div>
    </div>
  );
}

function BigStat({ label, value, suffix, tone }: { label: string; value: number; suffix?: string; tone: "bad" | "warn" | "ai" }) {
  const color = tone === "bad" ? "text-rose-300" : tone === "warn" ? "text-amber-300" : "text-violet-300";
  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-3 text-center">
      <div className={cn("font-mono text-2xl", color)}>
        {value}
        {suffix ? <span className="text-sm text-slate-500">{suffix}</span> : null}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}