import type { ReactNode } from "react";
import type { AccentTone, Health, Priority, Severity, TaskStatus } from "@/types";
import { cn } from "@/lib/cn";
import { initials, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/format";

/* ------------------------------- surfaces ------------------------------ */

export function Panel({
  children,
  className,
  soft,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  soft?: boolean;
  as?: "div" | "section" | "article";
}) {
  return (
    <As className={cn(soft ? "glass-soft" : "glass", "rounded-2xl", className)}>
      {children}
    </As>
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-4 pt-4", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon ? (
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-slate-300 hairline">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold tracking-wide text-slate-100 uppercase">{title}</h3>
          {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</div>
        ) : null}
        <h2 className="text-lg font-semibold text-slate-50">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- badges ------------------------------- */

const TONE_STYLES: Record<AccentTone, string> = {
  ok: "bg-emerald-500/12 text-emerald-300 border-emerald-400/30",
  warn: "bg-amber-500/12 text-amber-300 border-amber-400/30",
  bad: "bg-rose-500/12 text-rose-300 border-rose-400/30",
  ai: "bg-violet-500/14 text-violet-300 border-violet-400/30",
  blue: "bg-sky-500/12 text-sky-300 border-sky-400/30",
  neutral: "bg-white/6 text-slate-300 border-white/15",
};

export function BadgeTone({ tone, children, className }: { tone: AccentTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", TONE_STYLES[tone], className)}>
      {children}
    </span>
  );
}

export const severityTone: Record<Severity, AccentTone> = { critical: "bad", warning: "warn", info: "blue" };
export const healthTone: Record<Health, AccentTone> = { healthy: "ok", warning: "warn", critical: "bad" };
export const priorityTone: Record<Priority, AccentTone> = { critical: "bad", high: "warn", medium: "blue", low: "neutral" };
export const statusTone: Record<TaskStatus, AccentTone> = {
  completed: "ok",
  in_progress: "blue",
  blocked: "bad",
  at_risk: "warn",
  not_started: "neutral",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <BadgeTone tone={severityTone[severity]}>{severity.toUpperCase()}</BadgeTone>;
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <BadgeTone tone={priorityTone[priority]}>{PRIORITY_LABEL[priority]}</BadgeTone>;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <BadgeTone tone={statusTone[status]}>{STATUS_LABEL[status]}</BadgeTone>;
}

export function SourceBadge({ source }: { source: "verified" | "generated" }) {
  return source === "verified" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-300">
      ✓ VERIFIED FROM EVENT DATA
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/14 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-300">
      ✦ AI GENERATED INSIGHT
    </span>
  );
}

export function DemoTag({ label = "DEMO MODE" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300">
      ◈ {label}
    </span>
  );
}

/* ------------------------------- status dot ---------------------------- */

export function StatusDot({ tone, pulse }: { tone: AccentTone; pulse?: boolean }) {
  const color =
    tone === "ok" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : tone === "bad" ? "bg-rose-400" : tone === "ai" ? "bg-violet-400" : tone === "blue" ? "bg-sky-400" : "bg-slate-400";
  return <span className={cn("inline-block h-2 w-2 rounded-full", color, pulse && "animate-pulse")} />;
}

/* ------------------------------- buttons ------------------------------- */

type ButtonVariant = "primary" | "ghost" | "outline" | "ai" | "danger";

export function Button({
  children,
  onClick,
  variant = "outline",
  size = "md",
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const base = "focus-ring inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-sky-500 text-white hover:bg-sky-400 shadow-lg shadow-sky-500/20",
    ai: "bg-violet-500 text-white hover:bg-violet-400 shadow-lg shadow-violet-500/25",
    outline: "border border-white/12 bg-white/5 text-slate-200 hover:bg-white/10",
    ghost: "text-slate-300 hover:bg-white/8",
    danger: "border border-rose-400/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
  };
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={cn(base, sizes, variants[variant], className)}>
      {children}
    </button>
  );
}

/* -------------------------------- avatar ------------------------------- */

export function Avatar({ name, tone, size = 32 }: { name: string; tone: AccentTone; size?: number }) {
  const grad: Record<AccentTone, string> = {
    ok: "from-emerald-500/30 to-emerald-700/30 text-emerald-200",
    warn: "from-amber-500/30 to-amber-700/30 text-amber-200",
    bad: "from-rose-500/30 to-rose-700/30 text-rose-200",
    ai: "from-violet-500/35 to-indigo-700/30 text-violet-200",
    blue: "from-sky-500/30 to-blue-700/30 text-sky-200",
    neutral: "from-slate-500/30 to-slate-700/30 text-slate-200",
  };
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full border border-white/10 bg-gradient-to-br font-semibold", grad[tone])}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------- progress ------------------------------ */

export function ProgressBar({ value, tone = "blue", height = 6 }: { value: number; tone?: AccentTone; height?: number }) {
  const color =
    tone === "ok" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : tone === "bad" ? "bg-rose-400" : tone === "ai" ? "bg-violet-400" : "bg-sky-400";
  return (
    <div className="w-full overflow-hidden rounded-full bg-white/8" style={{ height }}>
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/* --------------------------------- tabs -------------------------------- */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  counts,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/4 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "focus-ring rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
            active === t.id ? "bg-white/12 text-white shadow-sm" : "text-slate-400 hover:text-slate-200",
          )}
        >
          {t.label}
          {counts?.[t.id] != null ? (
            <span className={cn("ml-1.5 rounded px-1 text-[10px]", active === t.id ? "bg-white/15" : "bg-white/8")}>
              {counts[t.id]}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- empty state --------------------------- */

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-white/12 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 truncate text-sm text-slate-200">{children}</div>
    </div>
  );
}
