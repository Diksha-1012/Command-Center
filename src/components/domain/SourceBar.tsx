import type { ReactNode } from "react";
import { Database, GitBranch, ListChecks, Package, Sparkles, Siren, Users2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * SOURCE LABELS (Part 3)
 * ======================================================================
 * Every AI explanation or recommendation carries an explicit label and lists
 * the verified records it was derived from. AI never silently overwrites
 * verified information — VERIFIED SOURCE means it came from structured event
 * data / Notion; AI GENERATED means it is an interpretation.
 */

export type BasisKey = "tasks" | "volunteers" | "dependencies" | "sessions" | "resources" | "incidents";

const BASIS_META: Record<BasisKey, { label: string; icon: typeof ListChecks }> = {
  tasks: { label: "Task data", icon: ListChecks },
  volunteers: { label: "Volunteer data", icon: Users2 },
  dependencies: { label: "Dependency graph", icon: GitBranch },
  sessions: { label: "Session data", icon: Database },
  resources: { label: "Resource data", icon: Package },
  incidents: { label: "Incident records", icon: Siren },
};

export function VerifiedBadge({ label = "VERIFIED SOURCE", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-300",
        className,
      )}
    >
      ✓ {label}
    </span>
  );
}

export function AiGeneratedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-500/14 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-300",
        className,
      )}
    >
      <Sparkles size={10} /> AI GENERATED
    </span>
  );
}

/** The "Based on:" provenance strip that accompanies every AI recommendation. */
export function AiBasis({ basis, className, note }: { basis: BasisKey[]; className?: string; note?: ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <AiGeneratedBadge />
      <span className="text-[10px] uppercase tracking-wide text-slate-500">Based on:</span>
      {basis.map((b) => {
        const meta = BASIS_META[b];
        const Icon = meta.icon;
        return (
          <span
            key={b}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300"
          >
            <Icon size={10} className="text-slate-500" />
            {meta.label}
          </span>
        );
      })}
      {note ? <span className="text-[10px] text-slate-500">{note}</span> : null}
    </div>
  );
}

export function SourceChip({ kind, label, className }: { kind: string; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-md border border-emerald-400/20 bg-emerald-500/8 px-1.5 py-0.5 text-[10px] text-emerald-200",
        className,
      )}
    >
      {kind}: {label}
    </span>
  );
}
