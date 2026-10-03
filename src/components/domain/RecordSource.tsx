import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Database, FlaskConical, Info, Radio } from "lucide-react";
import type { RecordSource, WorkspaceMode } from "@/types";
import { MODE_META, RECORD_SOURCE_META } from "@/lib/workspace";
import { cn } from "@/lib/cn";

/* -------------------------------------------------------------------------
 * DATA LABELS (Data Mode architecture)
 * Every important record exposes `Source: DEMO | LIVE | NOTION`.
 * AI output is labelled AI GENERATED and verified records VERIFIED
 * (see `SourceBar.tsx`).
 * ---------------------------------------------------------------------- */

const SOURCE_STYLES: Record<RecordSource, string> = {
  demo: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  live: "border-emerald-400/30 bg-emerald-500/12 text-emerald-300",
  notion: "border-sky-400/30 bg-sky-500/12 text-sky-300",
};

const SOURCE_ICON: Record<RecordSource, typeof FlaskConical> = {
  demo: FlaskConical,
  live: Radio,
  notion: Database,
};

/** `Source: DEMO` / `Source: LIVE` / `Source: NOTION` chip. */
export function RecordSourceLabel({
  source,
  compact,
  className,
}: {
  source?: RecordSource;
  compact?: boolean;
  className?: string;
}) {
  const resolved: RecordSource = source ?? "demo";
  const meta = RECORD_SOURCE_META[resolved];
  const Icon = SOURCE_ICON[resolved];
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        SOURCE_STYLES[resolved],
        className,
      )}
    >
      <Icon size={9} />
      {compact ? meta.label : `Source: ${meta.label}`}
    </span>
  );
}

/* ------------------------------ mode badge ---------------------------- */

export function ModeBadge({ mode, detail, className }: { mode: WorkspaceMode; detail?: string; className?: string }) {
  const meta = MODE_META[mode];
  const isDemo = mode === "demo";
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide",
        isDemo ? "border-amber-400/40 bg-amber-500/12 text-amber-200" : "border-emerald-400/40 bg-emerald-500/12 text-emerald-200",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", isDemo ? "bg-amber-400" : "bg-emerald-400", !isDemo && "animate-pulse")} />
      {meta.label}
      {detail ? <span className="font-medium text-slate-400">· {detail}</span> : null}
    </span>
  );
}

/* ---------------------------- mode switcher --------------------------- */

const MODES: { id: WorkspaceMode; icon: typeof FlaskConical; hint: string }[] = [
  { id: "demo", icon: FlaskConical, hint: "Synthetic KINETEX TECHFEST 2026 dataset" },
  { id: "live", icon: Radio, hint: "Real operational data you create" },
];

export function ModeSwitcher({
  mode,
  onChange,
  counts,
}: {
  mode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
  counts?: { demo: number; live: number };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const meta = MODE_META[mode];
  const isDemo = mode === "demo";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={meta.description}
        className={cn(
          "focus-ring inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-[11px] font-bold tracking-wide transition-colors",
          isDemo ? "border-amber-400/40 bg-amber-500/12 text-amber-200 hover:bg-amber-500/20" : "border-emerald-400/40 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20",
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", isDemo ? "bg-amber-400" : "bg-emerald-400 animate-pulse")} />
        {meta.label}
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-white/12 bg-ink-850/97 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/8 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Workspace mode</div>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
              Demo and live records are stored separately and are never mixed.
            </p>
          </div>
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = m.id === mode;
            const mMeta = MODE_META[m.id];
            const count = counts?.[m.id];
            return (
              <button
                key={m.id}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                  active ? "bg-white/8" : "hover:bg-white/5",
                )}
              >
                <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border", active ? "border-white/20 bg-white/10" : "border-white/10 bg-white/4")}>
                  <Icon size={12} className={m.id === "demo" ? "text-amber-300" : "text-emerald-300"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-100">{mMeta.label}</span>
                    {count != null ? <span className="text-[10px] text-slate-500">{count} records</span> : null}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{m.hint}</span>
                </span>
                {active ? <Check size={14} className="mt-0.5 shrink-0 text-emerald-300" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------- mode indicator --------------------------- */

/** A prominent, impossible-to-miss mode banner with a tooltip explaining both modes. */
export function ModeIndicator({ mode }: { mode: WorkspaceMode }) {
  const meta = MODE_META[mode];
  const isDemo = mode === "demo";
  return (
    <div
      title={meta.description}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2",
        isDemo ? "border-amber-400/25 bg-amber-500/8" : "border-emerald-400/25 bg-emerald-500/8",
      )}
    >
      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", isDemo ? "bg-amber-400" : "bg-emerald-400 animate-pulse")} />
      <div className="min-w-0">
        <div className={cn("text-xs font-bold tracking-wide", isDemo ? "text-amber-200" : "text-emerald-200")}>{meta.label}</div>
        <div className="truncate text-[10px] text-slate-400">
          {isDemo ? "Synthetic demonstration data" : "Real operational data"}
        </div>
      </div>
      <Info size={13} className="ml-auto shrink-0 text-slate-500" />
    </div>
  );
}

/** Inline banner shown at the top of pages when a demo-only narrative would mislead. */
export function DemoNarrativeNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/8 px-3 py-2.5">
      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />
      <p className="text-[11px] leading-relaxed text-slate-300">
        {children ?? "This panel is part of the synthetic KINETEX TECHFEST 2026 demonstration and is not shown for live data."}
      </p>
    </div>
  );
}
