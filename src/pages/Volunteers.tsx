import { useMemo, useState } from "react";
import { ArrowRight, Briefcase, CalendarClock, Filter, Sparkles, UserSquare2, Users2 } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { loadBand, volunteerLoadSummary } from "@/lib/selectors";
import { teamLoadMap, rebalanceSuggestions } from "@/lib/workloadAnalyzer";
import { coverageGaps } from "@/lib/recommendationEngine";
import { Avatar, BadgeTone, Button, ComingNext, Panel, PanelHeader, ProgressBar, SectionTitle, StatusDot, Tabs } from "@/components/ui/primitives";
import { MiniBars, StackedBar } from "@/components/ui/charts";
import { AssignmentCard } from "@/components/domain/AssignmentCard";
import { cn } from "@/lib/cn";
import type { VolunteerLoad } from "@/types";

const BAND_TONE: Record<VolunteerLoad, "ok" | "warn" | "bad"> = { underloaded: "warn", balanced: "ok", overloaded: "bad" };
const BAND_BAR: Record<VolunteerLoad, string> = { underloaded: "#38bdf8", balanced: "#34d399", overloaded: "#f87171" };

type View = "all" | "underloaded" | "balanced" | "overloaded";

export function Volunteers() {
  const { data, assignVolunteer, moveVolunteer } = useNexus();
  const [view, setView] = useState<View>("all");
  const [team, setTeam] = useState<string>("all");
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [movedIds, setMovedIds] = useState<string[]>([]);

  const summary = volunteerLoadSummary(data.volunteers);
  const loads = useMemo(() => teamLoadMap(data), [data]);
  const moves = useMemo(() => rebalanceSuggestions(data, loads), [data, loads]);
  const gaps = useMemo(() => coverageGaps(data), [data]);

  const visible = useMemo(
    () =>
      data.volunteers
        .filter((v) => (view === "all" ? true : loadBand(v.workload) === view))
        .filter((v) => (team === "all" ? true : v.teamId === team))
        .sort((a, b) => b.workload - a.workload),
    [data.volunteers, view, team],
  );

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="People"
        title="Volunteers"
        description="Workload, skills and live assignments across the volunteer pool."
        action={<ComingNext label="AI ALLOCATION — PART 2" />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Load Distribution" subtitle={`${data.volunteers.length} volunteers on the detail roster · pool of ${data.event.volunteerPool}`} icon={<Filter size={14} />} />
          <div className="p-4">
            <StackedBar
              segments={[
                { value: summary.underloaded, color: BAND_BAR.underloaded, label: "Underloaded" },
                { value: summary.balanced, color: BAND_BAR.balanced, label: "Balanced" },
                { value: summary.overloaded, color: BAND_BAR.overloaded, label: "Overloaded" },
              ]}
              height={12}
            />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {(["underloaded", "balanced", "overloaded"] as VolunteerLoad[]).map((band) => (
                <div key={band} className="rounded-xl border border-white/8 bg-white/3 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: BAND_BAR[band] }} />
                    <span className="text-[11px] uppercase tracking-wide text-slate-400">{band}</span>
                  </div>
                  <div className="mt-1 font-mono text-xl text-slate-100">{summary[band]}</div>
                  <div className="text-[10px] text-slate-500">
                    {band === "underloaded" ? "< 50% workload" : band === "balanced" ? "50–80% workload" : "> 80% workload"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Coverage Gaps" subtitle="Where the roster is short" icon={<UserSquare2 size={14} />} />
          <div className="space-y-2 p-4">
            {data.alerts.filter((a) => a.id === "a1" || a.id === "a6").map((a) => (
              <div key={a.id} className={cn("rounded-xl border border-white/8 bg-white/3 p-3 border-l-2", a.severity === "critical" ? "border-l-rose-400" : "border-l-amber-400")}>
                <div className="text-xs font-medium text-slate-200">{a.title}</div>
                <p className="mt-1 text-[11px] text-slate-500">{a.suggestedAction}</p>
              </div>
            ))}
            <div className="rounded-xl border border-violet-400/20 bg-violet-500/6 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-300">
                <Sparkles size={11} /> Copilot note
              </div>
              <p className="mt-1 text-[11px] text-slate-300">
                3 overloaded volunteers overlap on the Robotics Arena critical path. Rebalancing 2 standby volunteers would move the arena to balanced.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            { id: "all", label: "All", },
            { id: "underloaded", label: "Underloaded" },
            { id: "balanced", label: "Balanced" },
            { id: "overloaded", label: "Overloaded" },
          ]}
          active={view}
          onChange={setView}
          counts={{ all: data.volunteers.length, underloaded: summary.underloaded, balanced: summary.balanced, overloaded: summary.overloaded }}
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTeam("all")}
            className={cn("rounded-lg border px-2.5 py-1.5 text-[11px]", team === "all" ? "border-white/20 bg-white/10 text-slate-100" : "border-white/10 bg-white/4 text-slate-400 hover:text-slate-200")}
          >
            All teams
          </button>
          {data.teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setTeam(t.id)}
              className={cn("rounded-lg border px-2.5 py-1.5 text-[11px]", team === t.id ? "border-white/20 bg-white/10 text-slate-100" : "border-white/10 bg-white/4 text-slate-400 hover:text-slate-200")}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((v) => {
          const band = loadBand(v.workload);
          const teamName = data.teams.find((t) => t.id === v.teamId)?.name;
          return (
            <Panel key={v.id} className={cn("p-4", band === "overloaded" && "border-l-2 border-l-rose-400", band === "underloaded" && "border-l-2 border-l-sky-400")}>
              <div className="flex items-start gap-3">
                <Avatar name={v.name} tone={v.avatarTone} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-100">{v.name}</span>
                    <StatusDot tone={v.status === "assigned" ? "ok" : v.status === "standby" ? "warn" : "neutral"} />
                  </div>
                  <div className="text-[11px] text-slate-400">{v.role}</div>
                  <div className="text-[10px] text-slate-500">{teamName}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {v.skills.map((s) => (
                  <span key={s} className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{s}</span>
                ))}
              </div>

              <div className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5"><Briefcase size={11} className="text-slate-600" /> {v.currentAssignment}</div>
                <div className="flex items-center gap-1.5"><CalendarClock size={11} className="text-slate-600" /> {v.availability}</div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">Workload</span>
                  <span className="font-mono text-xs" style={{ color: BAND_BAR[band] }}>{v.workload}%</span>
                </div>
                <ProgressBar value={v.workload} tone={band === "overloaded" ? "bad" : band === "underloaded" ? "blue" : "ok"} height={6} />
              </div>

              <div className="mt-3 flex items-center justify-between">
                <BadgeTone tone={BAND_TONE[band]}>{band}</BadgeTone>
                <BadgeTone tone={v.status === "assigned" ? "ok" : v.status === "standby" ? "warn" : "neutral"}>{v.status.replace("_", " ")}</BadgeTone>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Workload balancer */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Team Load Map" subtitle="Mean volunteer workload blended with live task pressure" icon={<Users2 size={14} />} action={<BadgeTone tone={loads.some((l) => l.overloaded) ? "warn" : "ok"}>{loads.filter((l) => l.overloaded).length} overloaded</BadgeTone>} />
          <div className="space-y-3 p-4">
            <MiniBars data={loads.map((l) => ({ label: l.name, value: l.load, color: l.load > 80 ? "#f87171" : l.load > 65 ? "#fbbf24" : "#34d399" }))} />
            <div className="space-y-2">
              {loads.slice(0, 3).map((l) => (
                <div key={l.teamId} className={cn("rounded-xl border border-white/8 bg-white/3 p-2.5", l.overloaded && "border-l-2 border-l-rose-400")}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-200">{l.name}</span>
                    <span className={cn("font-mono text-xs", l.load > 80 ? "text-rose-300" : "text-slate-400")}>{l.load}%</span>
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {l.drivers.map((d) => (
                      <li key={d} className="text-[10px] text-slate-500">• {d}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Rebalance Workload" subtitle="Suggested moves for human review" icon={<ArrowRight size={14} />} />
          <div className="space-y-2 p-4">
            {moves.map((m) => {
              const done = movedIds.includes(m.id);
              const from = data.teams.find((t) => t.id === m.fromTeamId)?.name;
              const to = data.teams.find((t) => t.id === m.toTeamId)?.name;
              return (
                <div key={m.id} className={cn("rounded-xl border border-white/8 bg-white/3 p-3", done && "border-emerald-400/25")}>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    <span className="rounded bg-white/6 px-1.5 py-0.5">{from}</span>
                    <ArrowRight size={11} className="text-slate-600" />
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-200">{to}</span>
                    <BadgeTone tone="ai">+{m.expectedDelta}% shift</BadgeTone>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">{m.reason}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={done ? "outline" : "primary"}
                      disabled={done}
                      onClick={() => {
                        moveVolunteer(m.volunteerId, m.toTeamId, m.reason);
                        setMovedIds((prev) => [...prev, m.id]);
                      }}
                    >
                      {done ? "Rebalanced" : `Move ${m.volunteerName.split(" ")[0]}`}
                    </Button>
                    <span className="text-[10px] text-slate-500">Review before applying</span>
                  </div>
                </div>
              );
            })}
            {moves.length === 0 ? <p className="py-6 text-center text-xs text-emerald-300">No rebalancing needed — team load is within tolerance.</p> : null}
          </div>
        </Panel>
      </div>

      {/* Volunteer intelligence */}
      <Panel>
        <PanelHeader
          title="Volunteer Intelligence"
          subtitle="Skill, availability, workload, distance and shift-overlap matching for uncovered roles"
          icon={<Sparkles size={14} />}
          action={<ComingNext label="AUTO-ASSIGN STAYS OFF" />}
        />
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {gaps.slice(0, 4).map((g) => (
            <AssignmentCard
              key={g.context}
              recommendation={g}
              assignedId={assigned[g.context] ?? null}
              onAssign={(volunteerId, name) => {
                assignVolunteer(volunteerId, name);
                setAssigned((prev) => ({ ...prev, [g.context]: volunteerId }));
              }}
            />
          ))}
          {gaps.length === 0 ? (
            <div className="lg:col-span-2 rounded-xl border border-emerald-400/20 bg-emerald-500/6 p-3 text-xs text-emerald-200">
              Every upcoming session has volunteer-owned cover. No recommendations required.
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel soft className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            Recommendations are deterministic and explainable. NEXUS never assigns automatically — a coordinator reviews the
            rationale and confirms.
          </p>
          <Button size="sm" variant="outline" onClick={() => setView("overloaded")}>
            Show overloaded only
          </Button>
        </div>
      </Panel>
    </div>
  );
}
