import { useState } from "react";
import { Check, Sparkles, UserCheck, UserPlus } from "lucide-react";
import type { AssignmentRecommendation, CandidateScore } from "@/types";
import { cn } from "@/lib/cn";
import { Avatar, BadgeTone, Button } from "@/components/ui/primitives";
import { ProgressBar } from "@/components/ui/primitives";

/**
 * RECOMMEND → REVIEW → ASSIGN
 * The engine never assigns. This card requires an explicit human action and
 * shows the full scoring rationale before anything changes.
 */
export function AssignmentCard({
  recommendation,
  onAssign,
  assignedId,
}: {
  recommendation: AssignmentRecommendation;
  onAssign: (volunteerId: string, name: string) => void;
  assignedId?: string | null;
}) {
  const [stage, setStage] = useState<"recommend" | "review">("recommend");
  const [picked, setPicked] = useState<CandidateScore | null>(null);
  const candidates = [recommendation.best, ...recommendation.alternatives].filter(Boolean) as CandidateScore[];

  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border border-white/8 bg-white/3 p-3 text-[11px] text-slate-500">
        No scorable candidate for {recommendation.role}.
      </div>
    );
  }

  const best = recommended(candidates[0], picked ?? recommendation.best!);

  return (
    <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
            <Sparkles size={11} /> {recommendation.role}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{recommendation.context}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-0.5">
          {(["recommend", "review"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={cn("rounded-md px-2 py-1 text-[10px] uppercase tracking-wide", stage === s ? "bg-white/12 text-white" : "text-slate-400")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {stage === "recommend" ? (
        <div className="mt-3 space-y-2">
          {candidates.map((c, i) => (
            <button
              key={c.volunteerId}
              onClick={() => {
                setPicked(c);
                setStage("review");
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                i === 0 ? "border-violet-400/30 bg-violet-500/8 hover:bg-violet-500/14" : "border-white/8 bg-white/3 hover:bg-white/6",
              )}
            >
              <Avatar name={c.name} tone={i === 0 ? "ai" : "neutral"} size={30} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs text-slate-200">{c.name}</span>
                  {i === 0 ? <BadgeTone tone="ai">BEST MATCH</BadgeTone> : <BadgeTone tone="neutral">alternative</BadgeTone>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                  <span>skill {c.skillMatch}%</span>
                  <span>avail {c.availability}%</span>
                  <span>load {c.workload}%</span>
                  <span>distance {c.distance}</span>
                  <span>shift {c.shiftOverlap}%</span>
                </div>
              </div>
              <span className="font-mono text-sm text-slate-100">{c.total}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 p-2.5">
            <Avatar name={best.name} tone="ai" size={34} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-slate-200">{best.name}</div>
              <div className="text-[10px] text-slate-500">{best.role}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg text-slate-100">{best.total}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">score</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ScoreCell label="Skill match" value={best.skillMatch} />
            <ScoreCell label="Availability" value={best.availability} />
            <ScoreCell label="Spare capacity" value={100 - best.workload} />
            <ScoreCell label="Shift overlap" value={best.shiftOverlap} />
          </div>

          <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Why this candidate</div>
            <ul className="mt-1 space-y-1">
              {best.reasons.map((r) => (
                <li key={r} className="flex gap-2 text-[11px] text-slate-400">
                  <span className="text-slate-600">•</span> {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={assignedId === best.volunteerId ? "outline" : "primary"}
              disabled={assignedId === best.volunteerId}
              onClick={() => onAssign(best.volunteerId, `Assigned ${best.name} to ${recommendation.role}`)}
            >
              {assignedId === best.volunteerId ? <Check size={13} /> : <UserCheck size={13} />}
              {assignedId === best.volunteerId ? "Assigned" : "Assign selected"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setStage("recommend")}>
              <UserPlus size={13} /> Choose another
            </Button>
            <span className="text-[10px] text-slate-500">Human approval required — nothing is auto-assigned.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function recommended(best: CandidateScore, picked: CandidateScore) {
  return picked ?? best;
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 p-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
        <span className="font-mono text-[11px] text-slate-300">{value}%</span>
      </div>
      <div className="mt-1.5">
        <ProgressBar value={value} tone={value >= 80 ? "ok" : value >= 55 ? "warn" : "bad"} height={4} />
      </div>
    </div>
  );
}
