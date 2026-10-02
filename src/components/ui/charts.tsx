import type { Health, HealthMetric } from "@/types";
import { cn } from "@/lib/cn";
import { healthTone } from "./primitives";

const HEALTH_COLOR: Record<Health, string> = {
  healthy: "#34d399",
  warning: "#fbbf24",
  critical: "#f87171",
};

const SCORE_COLOR = (score: number) => HEALTH_COLOR[score >= 88 ? "healthy" : score >= 75 ? "warning" : "critical"];

/* --------------------------- radial gauge ----------------------------- */

export function RadialGauge({
  value,
  label,
  sublabel,
  size = 168,
  stroke = 12,
}: {
  value: number;
  label?: string;
  sublabel?: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const health: Health = value >= 88 ? "healthy" : value >= 75 ? "warning" : "critical";
  const color = HEALTH_COLOR[health];
  const dash = (value / 100) * c;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 700ms cubic-bezier(.16,1,.3,1)", filter: `drop-shadow(0 0 8px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-mono text-3xl font-semibold text-slate-50">{Math.round(value)}<span className="text-lg text-slate-400">%</span></div>
          {label ? <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div> : null}
          {sublabel ? <div className="mt-0.5 text-[11px] text-slate-500">{sublabel}</div> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------ health metric bars --------------------------- */

export function HealthMetricBars({ metrics }: { metrics: HealthMetric[] }) {
  return (
    <div className="space-y-3">
      {metrics.map((m, i) => {
        const color = SCORE_COLOR(m.score);
        return (
          <div key={m.label} className="animate-rise" style={{ animationDelay: `${i * 45}ms` }}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-xs font-medium text-slate-300">{m.label}</span>
              <span className="font-mono text-xs text-slate-400">{m.score}%</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${m.score}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 10px ${color}44` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------- mini donut ------------------------------- */

export function Donut({ segments, size = 132, thickness = 16 }: { segments: { value: number; color: string; label: string }[]; size?: number; thickness?: number }) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
      {segments.map((s) => {
        const len = (s.value / total) * c;
        const el = (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        );
        offset += len;
        return el;
      })}
    </svg>
  );
}

/* ----------------------------- sparkline ------------------------------- */

export function Sparkline({ points, color = "#60a5fa", height = 40, width = 160 }: { points: number[]; color?: string; height?: number; width?: number }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - ((p - min) / span) * (height - 6) - 3).toFixed(1)}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${color.replace("#", "")})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

/* --------------------------- horizontal bars --------------------------- */

export function MiniBars({ data }: { data: { label: string; value: number; max?: number; color?: string }[] }) {
  return (
    <div className="space-y-2.5">
      {data.map((d) => {
        const max = d.max ?? Math.max(...data.map((x) => x.value), 1);
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-slate-400">{d.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/6">
              <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? "#60a5fa" }} />
            </div>
            <span className="w-9 shrink-0 text-right font-mono text-xs text-slate-400">{d.value}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------ workload distribution ------------------------ */

export function StackedBar({ segments, height = 10 }: { segments: { value: number; color: string; label: string }[]; height?: number }) {
  const total = segments.reduce((n, s) => n + s.value, 0) || 1;
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-white/6" style={{ height }}>
      {segments.map((s) => (
        <div key={s.label} className="h-full" style={{ width: `${(s.value / total) * 100}%`, background: s.color }} title={`${s.label}: ${s.value}`} />
      ))}
    </div>
  );
}

export function HealthLegend({ items }: { items: { label: string; health: Health }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className={cn("h-2 w-2 rounded-full", healthTone[i.health] === "ok" ? "bg-emerald-400" : healthTone[i.health] === "warn" ? "bg-amber-400" : "bg-rose-400")} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
