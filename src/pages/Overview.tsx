import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowUpRight, Bot, Boxes, CalendarDays, CheckCircle2, Cog, Radio, ShieldCheck, Sparkles, Ticket, Users2,
} from "lucide-react";

const ROUTE_FOR_KIND: Record<string, string> = {
  task: "/tasks",
  session: "/schedule",
  volunteer: "/volunteers",
  resource: "/resources",
  venue: "/events",
  incident: "/incidents",
  team: "/teams",
  speaker: "/schedule",
};
import { useNexus } from "@/store/DataContext";
import { EVENT_DATE_LABEL, NOW } from "@/data/seed";
import {
  activeAlerts, computeKpis, eventHealthScore, healthLabel, operationalPulse, teamRollups, volunteerLoadSummary,
} from "@/lib/selectors";
import { KpiCard } from "@/components/domain/KpiCard";
import { dailyBrief, type BriefItem } from "@/lib/brief";
import { AlertCard } from "@/components/domain/AlertCard";
import { HealthMetricBars, RadialGauge, StackedBar } from "@/components/ui/charts";
import { Avatar, BadgeTone, Button, Panel, PanelHeader, ProgressBar, StatusDot } from "@/components/ui/primitives";
import { ModeBadge } from "@/components/domain/RecordSource";
import { timeOf } from "@/lib/format";
import { cn } from "@/lib/cn";

function BriefItemRow({ item, onOpen }: { item: BriefItem; onOpen: () => void }) {
  const isInsight = item.kind === "insight";
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-start gap-2.5 rounded-lg border border-white/8 bg-white/3 px-2.5 py-2 text-left hover:bg-white/6"
    >
      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", item.level === "critical" ? "bg-rose-400" : item.level === "warning" ? "bg-amber-400" : "bg-emerald-400")} />
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9px] font-bold tracking-wide"
          style={{
            background: isInsight ? "rgba(139,92,246,0.14)" : "rgba(16,185,129,0.12)",
            color: isInsight ? "#c4b5fd" : "#6ee7b7",
          }}
        >
          {isInsight ? "✦ AI INSIGHT" : "✓ VERIFIED"}
        </span>
        <span className="block text-xs text-slate-300">{item.text}</span>
        {item.why ? <span className="mt-0.5 block text-[10px] text-slate-500">why: {item.why}</span> : null}
        {item.ref ? <span className="mt-0.5 block text-[10px] text-slate-500">{item.ref.kind}: {item.ref.label}</span> : null}
      </span>
      <ArrowUpRight size={13} className="mt-0.5 shrink-0 text-slate-600" />
    </button>
  );
}

export function Overview() {
  const { data, mode, acknowledgeAlert } = useNexus();
  const navigate = useNavigate();
  const demo = mode === "demo";
  const brief = dailyBrief(data);
  const kpis = computeKpis(data);
  const health = eventHealthScore(data);
  const pulse = operationalPulse(data);
  const alerts = activeAlerts(data).filter((a) => !a.acknowledged).slice(0, 4);
  const teams = teamRollups(data);
  const load = volunteerLoadSummary(data.volunteers);

  const taskProgress = (kpis.tasksCompleted / kpis.tasksTotal) * 100;
  const inProgress = data.tasks.filter((t) => t.status === "in_progress").slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Panel className="relative overflow-hidden p-5 md:p-6">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <ModeBadge mode={mode} />
              <BadgeTone tone="ai">
                <Sparkles size={11} /> DEPENDENCY INTELLIGENCE ACTIVE
              </BadgeTone>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-50 md:text-3xl">{data.event.name}</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-400">{data.event.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} /> {EVENT_DATE_LABEL}</span>
              <span className="inline-flex items-center gap-1.5"><Ticket size={13} /> Main Auditorium, KIIT Campus</span>
              <span className="inline-flex items-center gap-1.5"><Cog size={13} /> Ops clock {timeOf(NOW)}</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck size={13} /> {data.event.organizers.join(" · ")}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => navigate("/command")}>
              <Activity size={15} /> Command Center
            </Button>
            <Button variant="ai" onClick={() => navigate("/copilot")}>
              <Bot size={15} /> Ask Copilot
            </Button>
          </div>
        </div>
      </Panel>

      {/* Daily brief — grounded in real data in LIVE mode; demo narrative otherwise */}
      <Panel className="relative overflow-hidden">
        <PanelHeader
          title="NEXUS Daily Brief"
          subtitle={demo ? "Every line links to the underlying record" : "Generated from your live operational records"}
          icon={<Sparkles size={14} />}
          action={<BadgeTone tone="ai">generated · grounded in {demo ? "event" : "live"} data</BadgeTone>}
        />
        {!demo && data.tasks.length === 0 && data.sessions.length === 0 ? (
          <div className="p-4">
            <p className="text-sm text-slate-300">No live records yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Add your event, sessions, teams and tasks in the Data Studio — the daily brief will build itself from what you
              enter.
            </p>
            <Button className="mt-3" variant="primary" onClick={() => navigate("/data")}>
              Open Data Studio
            </Button>
          </div>
        ) : null}
        {!demo && (data.tasks.length > 0 || data.sessions.length > 0) ? (
          <div className="grid gap-4 p-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p className="text-sm font-medium text-slate-200">{brief.greeting}</p>
              <div className="mt-3 space-y-1.5">
                {brief.items.length === 0 ? (
                  <p className="text-xs text-slate-500">No operational issues detected from your live records.</p>
                ) : (
                  brief.items.map((item) => (
                    <BriefItemRow key={item.id} item={item} onOpen={() => navigate(item.ref ? ROUTE_FOR_KIND[item.ref.kind] ?? "/command" : "/command")} />
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recommended actions</div>
              <div className="mt-2 space-y-2">
                {brief.actions.slice(0, 4).map((a, i) => (
                  <div key={a.id} className="rounded-xl border border-white/8 bg-white/3 p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="grid h-5 w-5 place-items-center rounded-md bg-violet-500/15 text-[10px] font-bold text-violet-300">{i + 1}</span>
                      <span className="text-[11px] font-medium text-slate-200">{a.title}</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">{a.detail}</p>
                  </div>
                ))}
                {brief.actions.length === 0 ? <p className="text-[11px] text-slate-500">No actions recommended.</p> : null}
              </div>
            </div>
          </div>
        ) : null}
        {demo ? (
        <div className="grid gap-4 p-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="text-sm font-medium text-slate-200">{brief.greeting}</p>
            <div className="mt-3 space-y-1.5">
              {brief.items.map((item) => (
                <BriefItemRow key={item.id} item={item} onOpen={() => navigate(item.ref ? ROUTE_FOR_KIND[item.ref.kind] ?? "/command" : "/command")} />
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Recommended actions</div>
            <div className="mt-2 space-y-2">
              {brief.actions.slice(0, 4).map((a, i) => (
                <div key={a.id} className="rounded-xl border border-white/8 bg-white/3 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-violet-500/15 text-[10px] font-bold text-violet-300">{i + 1}</span>
                    <span className="text-[11px] font-medium text-slate-200">{a.title}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">{a.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {brief.health.map((h) => (
                <div key={h.label} className="rounded-lg border border-white/8 bg-white/3 p-2">
                  <div className="font-mono text-sm text-slate-100">{h.value}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{h.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        ) : null}
      </Panel>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total Participants" value={kpis.participants.toLocaleString()} sub="Registered attendees" icon={<Users2 size={16} />} tone="blue" />
        <KpiCard label="Active Volunteers" value={kpis.activeVolunteers} sub={`${data.volunteers.filter((v) => v.status === "assigned").length} on shift now`} icon={<Users2 size={16} />} tone="ok" />
        <KpiCard
          label="Tasks"
          value={`${kpis.tasksCompleted}/${kpis.tasksTotal}`}
          sub="completed today"
          icon={<CheckCircle2 size={16} />}
          tone={taskProgress > 60 ? "ok" : "warn"}
          accent={<ProgressBar value={taskProgress} tone={taskProgress > 60 ? "ok" : "warn"} height={5} />}
        />
        <KpiCard label="At-Risk Items" value={kpis.atRiskItems} sub="alerts + blockers" icon={<AlertTriangle size={16} />} tone="bad" />
        <KpiCard label="Upcoming Sessions" value={kpis.upcomingSessions} sub="programme items remaining" icon={<CalendarDays size={16} />} tone="ai" />
        <KpiCard label="Resource Utilization" value={`${Math.round(kpis.resourceUtilization)}%`} sub="units allocated" icon={<Boxes size={16} />} tone="warn" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Event health */}
        <Panel className="xl:col-span-1">
          <PanelHeader title="Event Health" subtitle="Composite operational score across all departments" icon={<Activity size={14} />} />
          <div className="flex flex-col items-center gap-5 px-4 py-5 sm:flex-row sm:items-center">
            <RadialGauge value={health} label={healthLabel(health)} sublabel="weighted average" />
            <div className="w-full flex-1">
              <HealthMetricBars metrics={data.healthMetrics} />
            </div>
          </div>
        </Panel>

        {/* Pulse */}
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Operational Pulse"
            subtitle="Live status of every critical workstream"
            icon={<Radio size={14} />}
            action={
              <Button size="sm" variant="ghost" onClick={() => navigate("/command")}>
                Open <ArrowUpRight size={13} />
              </Button>
            }
          />
          <div className="grid gap-2 p-4 sm:grid-cols-2">
            {pulse.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate("/command")}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-left transition-colors hover:bg-white/6"
              >
                <StatusDot tone={p.health === "healthy" ? "ok" : p.health === "warning" ? "warn" : "bad"} pulse={p.health === "critical"} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-200">{p.label}</div>
                  <div className="truncate text-[11px] text-slate-500">{p.detail}</div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                    p.health === "healthy" ? "bg-emerald-500/12 text-emerald-300" : p.health === "warning" ? "bg-amber-500/12 text-amber-300" : "bg-rose-500/12 text-rose-300",
                  )}
                >
                  {p.metric ?? p.health}
                </span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-white/8 px-4 py-4 sm:grid-cols-4">
            {teams.slice(0, 4).map((t) => (
              <div key={t.teamId} className="rounded-xl border border-white/8 bg-white/3 p-3">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-medium text-slate-300">{t.name}</span>
                  <StatusDot tone={t.status === "healthy" ? "ok" : t.status === "warning" ? "warn" : "bad"} />
                </div>
                <div className="mt-1.5 text-[11px] text-slate-500">{t.leadName}</div>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{t.openTasks} open</span>·<span>{t.doneTasks} done</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Alerts */}
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Priority Alerts"
            subtitle="Highest-severity unacknowledged issues"
            icon={<AlertTriangle size={14} />}
            action={
              <BadgeTone tone="bad">{activeAlerts(data).filter((a) => !a.acknowledged).length} open</BadgeTone>
            }
          />
          <div className="space-y-2 p-4">
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} onAcknowledge={acknowledgeAlert} compact />
            ))}
            {alerts.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">All alerts acknowledged.</p> : null}
          </div>
        </Panel>

        {/* Task stream + volunteer coverage */}
        <div className="space-y-6">
          <Panel>
            <PanelHeader title="Task Stream" subtitle="Active workstreams" icon={<CheckCircle2 size={14} />} action={<Button size="sm" variant="ghost" onClick={() => navigate("/tasks")}>Board <ArrowUpRight size={13} /></Button>} />
            <div className="space-y-2 p-4">
              {inProgress.map((t) => {
                const owner = t.ownerKind === "volunteer" ? data.volunteers.find((v) => v.id === t.ownerId) : data.members.find((m) => m.id === t.ownerId);
                return (
                  <div key={t.id} className="rounded-xl border border-white/8 bg-white/3 p-2.5">
                    <div className="flex items-start gap-2.5">
                      <Avatar name={owner?.name ?? "?"} tone={t.ownerKind === "volunteer" ? "blue" : "ai"} size={26} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-slate-200">{t.title}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <ProgressBar value={t.progress} tone="blue" height={4} />
                          <span className="font-mono text-[10px] text-slate-500">{t.progress}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Volunteer Coverage" subtitle="Workload distribution" icon={<Users2 size={14} />} />
            <div className="p-4">
              <StackedBar
                segments={[
                  { value: load.underloaded, color: "#38bdf8", label: "Underloaded" },
                  { value: load.balanced, color: "#34d399", label: "Balanced" },
                  { value: load.overloaded, color: "#f87171", label: "Overloaded" },
                ]}
              />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="font-mono text-lg text-sky-300">{load.underloaded}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Under</div>
                </div>
                <div>
                  <div className="font-mono text-lg text-emerald-300">{load.balanced}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Balanced</div>
                </div>
                <div>
                  <div className="font-mono text-lg text-rose-300">{load.overloaded}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Over</div>
                </div>
              </div>
              <Button className="mt-3 w-full" size="sm" variant="ghost" onClick={() => navigate("/volunteers")}>
                Manage roster
              </Button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
