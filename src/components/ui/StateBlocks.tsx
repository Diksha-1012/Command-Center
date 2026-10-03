import type { ReactNode } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/primitives";

/** RELIABILITY UI (Part 3): loading, error and inline notice states. */

export function LoadingBlock({ label = "Loading…", rows = 3, className }: { label?: string; rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Loader2 size={13} className="animate-spin" /> {label}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg border border-white/8 bg-white/4" />
      ))}
    </div>
  );
}

export function ErrorBlock({
  title = "Something went wrong",
  message,
  onRetry,
  retrying,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-rose-400/25 bg-rose-500/8 p-3", className)}>
      <div className="flex items-start gap-2.5">
        <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-300" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-rose-200">{title}</div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{message}</p>
          {onRetry ? (
            <Button size="sm" variant="outline" className="mt-2" onClick={onRetry} disabled={retrying}>
              <RefreshCw size={12} className={retrying ? "animate-spin" : ""} /> {retrying ? "Retrying…" : "Retry"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warn" | "ok";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const styles =
    tone === "warn"
      ? "border-amber-400/25 bg-amber-500/8 text-amber-200"
      : tone === "ok"
        ? "border-emerald-400/25 bg-emerald-500/8 text-emerald-200"
        : "border-sky-400/25 bg-sky-500/8 text-sky-200";
  return (
    <div className={cn("rounded-xl border p-3 text-[11px] leading-relaxed", styles, className)}>
      {title ? <div className="mb-0.5 font-semibold uppercase tracking-wide">{title}</div> : null}
      <div className="text-slate-300">{children}</div>
    </div>
  );
}

export function StatChip({ label, value, tone = "neutral" }: { label: string; value: ReactNode; tone?: "ok" | "warn" | "bad" | "ai" | "blue" | "neutral" }) {
  const styles =
    tone === "ok"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "bad"
          ? "text-rose-300"
          : tone === "ai"
            ? "text-violet-300"
            : tone === "blue"
              ? "text-sky-300"
              : "text-slate-200";
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
      <div className={cn("font-mono text-lg", styles)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}