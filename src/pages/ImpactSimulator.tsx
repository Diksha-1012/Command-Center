import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, BrainCircuit, Check, GitBranch, Play, RotateCcw, Sparkles, TriangleAlert, Wand2, X,
} from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { simulateChange } from "@/lib/changeSimulator";
import { BadgeTone, Button, Panel, PanelHeader, SectionTitle, SourceBadge } from "@/components/ui/primitives";
import { DependencyChain } from "@/components/domain/DependencyChain";
import { timeOf } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ChangeKind, ChangeRequest, SimulationResult } from "@/types";

const CHANGES: { kind: ChangeKind; label: string; blurb: string }[] = [
  { kind: "change_venue", label: "Change venue", blurb: "Move a session to a different hall" },
  { kind: "delay_session", label: "Delay session", blurb: "Push a session later in the day" },
  { kind: "change_time", label: "Change session time", blurb: "Shift start and end together" },
  { kind: "remove_volunteer", label: "Remove volunteer", blurb: "Take a volunteer off the roster" },
  { kind: "remove_resource", label: "Remove resource", blurb: "Take equipment out of service" },
  { kind: "change_team", label: "Change team assignment", blurb: "Hand a session to another team" },
];

const DELAY_OPTIONS = [15, 30, 45, 60];

export function ImpactSimulator() {
  const { data, graph, risk, applySimulation } = useNexus();
  const navigate = useNavigate();

  const [kind, setKind] = useState<ChangeKind>("change_venue");
  const [subjectId, setSubjectId] = useState("s-hack");
  const [targetId, setTargetId] = useState("v-innov");
  const [minutes, setMinutes] = useState(30);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [applied, setApplied] = useState(false);

  const needsVenue = kind === "change_venue";
  const needsTeam = kind === "change_team";
  const needsMinutes = kind === "delay_session" || kind === "change_time";
  const subjectKind = kind === "remove_volunteer" ? "volunteer" : kind === "remove_resource" ? "resource" : "session";

  const subjects = useMemo(() => {
    if (subjectKind === "volunteer") return data.volunteers.map((v) => ({ id: v.id, label: `${v.name} · ${v.role}` }));
    if (subjectKind === "resource") return data.resources.map((r) => ({ id: r.id, label: `${r.name} · ${r.location}` }));
    return data.sessions.map((s) => ({ id: s.id, label: `${s.title} · ${timeOf(s.startsAt)} · ${data.venues.find((v) => v.id === s.venueId)?.name}` }));
  }, [subjectKind, data]);

  const request = useMemo<ChangeRequest>(() => {
    if (subjectKind === "volunteer") {
      const v = data.volunteers.find((x) => x.id === subjectId);
      return { kind, subjectId, subjectKind: "volunteer", subjectLabel: v?.name ?? subjectId, fromValue: v?.currentAssignment ?? "assigned", toValue: "removed from roster" };
    }
    if (subjectKind === "resource") {
      const r = data.resources.find((x) => x.id === subjectId);
      return { kind, subjectId, subjectKind: "resource", subjectLabel: r?.name ?? subjectId, fromValue: `${r?.available ?? 0} available`, toValue: "out of service" };
    }
    const s = data.sessions.find((x) => x.id === subjectId);
    const venue = data.venues.find((v) => v.id === s?.venueId);
    if (kind === "change_venue") {
      return { kind, subjectId, subjectKind: "session", subjectLabel: s?.title ?? subjectId, fromValue: venue?.name ?? "—", toValue: data.venues.find((v) => v.id === targetId)?.name ?? "—", toId: targetId };
    }
    if (kind === "change_team") {
      const team = data.teams.find((t) => t.id === s?.teamId);
      return { kind, subjectId, subjectKind: "session", subjectLabel: s?.title ?? subjectId, fromValue: team?.name ?? "—", toValue: data.teams.find((t) => t.id === targetId)?.name ?? "—", toId: targetId };
    }
    return { kind, subjectId, subjectKind: "session", subjectLabel: s?.title ?? subjectId, fromValue: s ? timeOf(s.startsAt) : "—", toValue: `+${minutes} minutes`, minutes };
  }, [kind, subjectId, subjectKind, targetId, minutes, data]);

  const onKindChange = (next: ChangeKind) => {
    setKind(next);
    setResult(null);
    setApplied(false);
    if (next === "remove_volunteer") setSubjectId("v13");
    else if (next === "remove_resource") setSubjectId("r6");
    else setSubjectId("s-hack");
    setTargetId(next === "change_team" ? "t-tech" : "v-innov");
  };

  const run = () => {
    setResult(simulateChange(data, request, { graph, risk }));
    setApplied(false);
  };

  const apply = () => {
    if (!result) return;
    applySimulation(result);
    setApplied(true);
  };

  const discard = () => {
    setResult(null);
    setApplied(false);
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Dependency Intelligence"
        title="Impact Simulator"
        description="Change one operational element, preview everything downstream, then approve or discard. Nothing is written until you apply."
        action={<BadgeTone tone="ai"><GitBranch size={11} /> engine: graph</BadgeTone>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ---------------- configuration ---------------- */}
        <Panel className="lg:col-span-1 self-start">
          <PanelHeader title="What changed?" subtitle="Simulation is a projection — real data is untouched" icon={<BrainCircuit size={14} />} />
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              {CHANGES.map((c) => (
                <button
                  key={c.kind}
                  onClick={() => onKindChange(c.kind)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all",
                    kind === c.kind ? "border-violet-400/35 bg-gradient-to-r from-violet-500/16 to-sky-500/8" : "border-white/8 bg-white/3 hover:bg-white/6",
                  )}
                >
                  <span className={cn("grid h-7 w-7 place-items-center rounded-lg border", kind === c.kind ? "border-violet-400/30 bg-violet-500/15 text-violet-300" : "border-white/10 bg-white/5 text-slate-400")}>
                    <Wand2 size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-slate-200">{c.label}</span>
                    <span className="block text-[10px] text-slate-500">{c.blurb}</span>
                  </span>
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-ink-850 px-3 py-2 text-sm text-slate-200 focus:border-sky-400/50 focus:outline-none"
              >
                {subjects.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>

            {needsVenue ? (
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">New venue</label>
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-ink-850 px-3 py-2 text-sm text-slate-200 focus:border-violet-400/50 focus:outline-none">
                  {data.venues.map((v) => (
                    <option key={v.id} value={v.id}>{v.name} · cap {v.capacity.toLocaleString()}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {needsTeam ? (
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">New team</label>
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-ink-850 px-3 py-2 text-sm text-slate-200 focus:border-violet-400/50 focus:outline-none">
                  {data.teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {needsMinutes ? (
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Shift by</label>
                <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/10 bg-white/4 p-1">
                  {DELAY_OPTIONS.map((m) => (
                    <button key={m} onClick={() => setMinutes(m)} className={cn("rounded-lg px-2 py-1.5 text-[11px]", minutes === m ? "bg-white/12 text-white" : "text-slate-400 hover:text-slate-200")}>
                      +{m}m
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {subjectKind !== "session" ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/6 p-3 text-[11px] text-slate-300">
                This is a removal simulation. The subject stays live until you apply.
              </div>
            ) : null}

            <div className="rounded-xl border border-white/8 bg-white/3 p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Proposed change</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-200">
                <span className="rounded-md bg-white/6 px-1.5 py-0.5">{request.fromValue}</span>
                <ArrowRight size={12} className="text-slate-600" />
                <span className="rounded-md bg-violet-500/15 px-1.5 py-0.5 text-violet-200">{request.toValue}</span>
              </div>
            </div>

            <Button variant="ai" className="w-full" onClick={run}>
              <Play size={15} /> Simulate impact
            </Button>
          </div>
        </Panel>

        {/* ---------------- results ---------------- */}
        <div className="space-y-5 lg:col-span-2">
          {!result ? (
            <Panel className="grid min-h-[440px] place-items-center p-8 text-center">
              <div className="max-w-md">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-violet-400/25 bg-violet-500/10 text-violet-300">
                  <BrainCircuit size={22} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-slate-200">Nothing simulated yet</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  Pick a change on the left and run the simulation. NEXUS traverses the dependency graph, groups the
                  results into direct, indirect and potential impact, then explains every risk it finds.
                </p>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/4 p-3 text-left text-[11px] text-slate-400">
                  <span className="text-slate-300">Try the demo scenario:</span> change venue for <span className="text-slate-200">Hackathon Final Pitch</span> → <span className="text-slate-200">Innovation Hall</span>.
                </div>
              </div>
            </Panel>
          ) : (
            <>
              {/* Impact summary */}
              <Panel className={cn(applied ? "border-emerald-400/25" : "ai-glow")}>
                <PanelHeader
                  title={applied ? "Change applied" : "Impact Preview"}
                  subtitle={applied ? "The change is live in the demo dataset — see the audit trail for the full trace." : `${result.analysis.totalAffected} downstream items · engine: graph`}
                  icon={applied ? <BadgeCheck size={14} /> : <Sparkles size={14} />}
                  action={
                    applied ? <BadgeTone tone="ok"><Check size={11} /> APPLIED</BadgeTone> : <BadgeTone tone="ai">PROJECTION · NOT APPLIED</BadgeTone>
                  }
                />
                <div className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                    <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1">{result.request.subjectLabel}</span>
                    <ArrowRight size={14} className="text-slate-600" />
                    <span className="rounded-lg border border-violet-400/25 bg-violet-500/12 px-2.5 py-1 text-violet-200">{result.request.toValue}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat value={result.analysis.impactScore} label="Impact score" suffix="/100" tone={result.analysis.impactLevel} />
                    <Stat value={result.analysis.direct.length} label="Direct" tone="high" />
                    <Stat value={result.analysis.indirect.length} label="Indirect" tone="medium" />
                    <Stat value={result.analysis.potential.length} label="Potential" tone="low" />
                  </div>

                  <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Why this score?</div>
                    <ul className="mt-1.5 space-y-1">
                      {result.analysis.scoreReasons.map((r) => (
                        <li key={r} className="flex gap-2 text-[11px] text-slate-300">
                          <span className="text-slate-600">•</span> {r}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!applied ? (
                      <>
                        <Button variant="primary" onClick={apply}>
                          <Check size={14} /> Apply change
                        </Button>
                        <Button variant="outline" onClick={discard}>
                          <RotateCcw size={14} /> Discard simulation
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="primary" onClick={() => navigate("/command")}>
                          Open Command Center <ArrowRight size={14} />
                        </Button>
                        <Button variant="outline" onClick={() => navigate("/timeline")}>
                          View audit trail
                        </Button>
                        <Button variant="ghost" onClick={discard}>
                          <X size={14} /> Close
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Panel>

              {/* Before / after */}
              <Panel>
                <PanelHeader title="Before / After" subtitle="Field-level comparison of the proposed change" icon={<RotateCcw size={14} />} />
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  <DiffTable title="Before" rows={result.before} tone="neutral" />
                  <DiffTable title="After" rows={result.after} tone="warn" />
                </div>
              </Panel>

              {/* Per-kind summary */}
              <Panel>
                <PanelHeader title="Impact Summary" subtitle="What moves, by category" icon={<GitBranch size={14} />} />
                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {result.analysis.byKind.map((k) => (
                    <div key={k.kind} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
                      <span className="text-xs text-slate-300">{k.label} affected</span>
                      <span className="font-mono text-sm text-slate-100">{k.count}</span>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Blast radius */}
              <Panel>
                <PanelHeader title="Impact Graph" subtitle="Direct → indirect → potential propagation" icon={<GitBranch size={14} />} />
                <div className="p-4">
                  <DependencyChain analysis={result.analysis} />
                </div>
              </Panel>

              {/* Risks */}
              <Panel>
                <PanelHeader title="Risks Detected" subtitle="Deterministic rules, each with its explanation" icon={<TriangleAlert size={14} />} action={<BadgeTone tone={result.risks.some((r) => r.level === "critical") ? "bad" : "warn"}>{result.risks.length} findings</BadgeTone>} />
                <div className="space-y-2 p-4">
                  {result.risks.map((r) => (
                    <div key={r.id} className={cn("rounded-xl border border-white/8 bg-white/3 p-3 border-l-2", r.level === "critical" ? "border-l-rose-400" : r.level === "high" ? "border-l-amber-400" : "border-l-sky-400")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <BadgeTone tone={r.level === "critical" ? "bad" : r.level === "high" ? "warn" : "blue"}>{r.level.toUpperCase()}</BadgeTone>
                        <span className="text-xs font-medium text-slate-100">{r.title}</span>
                        <span className="ml-auto font-mono text-[10px] text-slate-600">{r.rule}</span>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{r.reason}</p>
                      {r.related.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.related.slice(0, 4).map((ref) => (
                            <span key={`${ref.kind}-${ref.id}`} className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                              {ref.kind}: {ref.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {result.risks.length === 0 ? <p className="py-4 text-center text-sm text-emerald-300">No risk conditions detected for this change.</p> : null}
                </div>
              </Panel>

              {/* Recommended actions */}
              <Panel>
                <PanelHeader title="Recommended Actions" subtitle="Human review required — nothing is auto-executed" icon={<Wand2 size={14} />} />
                <div className="space-y-2 p-4">
                  {result.actions.map((a) => (
                    <div key={a.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <BadgeTone tone={a.priority === "critical" ? "bad" : a.priority === "high" ? "warn" : "blue"}>{a.priority}</BadgeTone>
                        <span className="text-xs font-medium text-slate-100">{a.title}</span>
                        <span className="ml-auto rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">{a.kind}</span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">{a.detail}</p>
                      {a.related.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {a.related.slice(0, 4).map((ref) => (
                            <span key={`${ref.kind}-${ref.id}`} className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                              {ref.kind}: {ref.label}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </Panel>

              {/* AI explanation */}
              <Panel>
                <PanelHeader title="AI Impact Explanation" subtitle="Narrative summary — not a verified fact" icon={<Sparkles size={14} />} />
                <div className="space-y-3 p-4">
                  <SourceBadge source="generated" />
                  <p className="text-sm leading-relaxed text-slate-300">{result.aiExplanation}</p>
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/6 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <SourceBadge source="verified" />
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">source data</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {result.analysis.sourceRecords.map((ref) => (
                        <span key={`${ref.kind}-${ref.id}`} className="rounded-md border border-emerald-400/20 bg-emerald-500/8 px-1.5 py-0.5 text-[10px] text-emerald-200">
                          {ref.kind}: {ref.label}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400">
                      These records are the verified evidence the analysis is built on. The explanation above is a generated
                      narrative over them.
                    </p>
                  </div>
                  <BadgeTone tone="ai">
                    <Sparkles size={11} /> NARRATIVE GENERATED FROM THE GRAPH · NO EXTERNAL LLM
                  </BadgeTone>
                </div>
              </Panel>
            </>
          )}

          <Panel>
            <PanelHeader title="Graph Snapshot" subtitle="The dependency graph the engine traverses" icon={<GitBranch size={14} />} />
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              <MiniStat label="Nodes" value={Object.keys(graph.nodes).length} />
              <MiniStat label="Edges" value={graph.edges.length} />
              <MiniStat label="Risk findings" value={risk.findings.length} />
              <MiniStat label="Critical nodes" value={risk.counts.critical} tone="bad" />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, suffix, tone }: { value: number; label: string; suffix?: string; tone: string }) {
  const color = tone === "critical" ? "text-rose-300" : tone === "high" ? "text-amber-300" : tone === "medium" ? "text-sky-300" : "text-slate-300";
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
      <div className={cn("font-mono text-2xl", color)}>
        {value}
        {suffix ? <span className="text-sm text-slate-500">{suffix}</span> : null}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function DiffTable({ title, rows, tone }: { title: string; rows: SimulationResult["before"]; tone: "neutral" | "warn" }) {
  return (
    <div className={cn("rounded-xl border p-3", tone === "warn" ? "border-violet-400/25 bg-violet-500/6" : "border-white/8 bg-white/3")}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3">
            <span className="text-[11px] text-slate-500">{r.label}</span>
            <span className={cn("text-right text-xs", tone === "warn" ? "text-slate-100" : "text-slate-300")}>
              {tone === "warn" ? r.after : r.before}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone?: "bad" }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
      <div className={cn("font-mono text-xl", tone === "bad" ? "text-rose-300" : "text-slate-100")}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
