import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowUpRight, Boxes, CalendarDays, CheckCircle2, History, Radio, ShieldAlert, UserSquare2, Users2,
} from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { NOW } from "@/data/seed";
import { activeAlerts, operationalPulse, resourceConflicts, teamRollups, volunteerLoadSummary } from "@/lib/selectors";
import { Avatar, BadgeTone, Button, Panel, PanelHeader, ProgressBar, SectionTitle, StatusDot } from "@/components/ui/primitives";
import { AlertCard } from "@/components/domain/AlertCard";
import { SessionDrawer } from "@/components/domain/SessionDrawer";
import { RiskMap } from "@/components/domain/RiskMap";
import { StackedBar } from "@/components/ui/charts";
import { relativeFromNow, timeOf } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { PulseItem } from "@/types";

export function CommandCenter() {
  const { data, acknowledgeAlert, acknowledgeAll, risk } = useNexus();
  const navigate = useNavigate();
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  const pulse = operationalPulse(data);
  const alerts = activeAlerts(data);
  const teams = teamRollups(data);
  const load = volunteerLoadSummary(data.volunteers);
  const conflicts = resourceConflicts(data.resources);

  const openSession = data.sessions.find((s) => s.id === openSessionId) ?? null;

  const upcoming = useMemo(
    () =>
      [...data.sessions]
        .filter((s) => new Date(s.endsAt).getTime() >= new Date(NOW).getTime())
        .sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
        .slice(0, 5),
    [data.sessions],
  );

  const changes = useMemo(() => {
    const items = [
      ...data.alerts.map((a) => ({ id: `a-${a.id}`, at: a.timestamp, text: a.title, tone: a.severity === "critical" ? "bad" : a.severity === "warning" ? "warn" : "blue" })),
      ...data.communications.map((c) => ({ id: `c-${c.id}`, at: c.scheduledAt, text: `${c.channel.toUpperCase()} · ${c.subject}`, tone: "ai" })),
      ...data.tasks.filter((t) => t.status === "completed").map((t) => ({ id: `t-${t.id}`, at: t.deadline, text: `Completed: ${t.title}`, tone: "ok" })),
    ];
    return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);
  }, [data]);

  const handlePulseClick = (item: PulseItem) => {
    if (item.entity.kind === "session") setOpenSessionId(item.entity.id);
    else if (item.entity.kind === "task") navigate("/tasks");
    else if (item.entity.kind === "resource") navigate("/resources");
    else if (item.entity.kind === "volunteer") navigate("/volunteers");
    else navigate("/schedule");
  };

  const critical = alerts.filter((a) => a.severity === "critical" && !a.acknowledged);
  const otherAlerts = alerts.filter((a) => a.severity !== "critical").slice(0, 4);

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Live Operations"
        title="Command Center"
        description="Everything happening right now, ranked by what will break next."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={acknowledgeAll}>
              <CheckCircle2 size={14} /> Acknowledge all
            </Button>
            <Button size="sm" variant="ai" onClick={() => navigate("/impact")}>
              <Activity size={14} /> Run impact sim
            </Button>
          </div>
        }
      />

      {/* Operational Pulse — hero strip */}
      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <PanelHeader
          title="Operational Pulse"
          subtitle="Click any workstream to drill into its owner, equipment and dependencies"
          icon={<Radio size={14} />}
          action={<BadgeTone tone="ok"><StatusDot tone="ok" pulse /> Live</BadgeTone>}
        />
        <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-3">
          {pulse.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePulseClick(p)}
              className={cn(
                "group relative flex items-start gap-3 overflow-hidden rounded-xl border border-white/8 bg-white/3 p-3 text-left transition-all hover:border-white/16 hover:bg-white/6",
                p.health === "critical" && "border-l-2 border-l-rose-400",
                p.health === "warning" && "border-l-2 border-l-amber-400",
                p.health === "healthy" && "border-l-2 border-l-emerald-400",
              )}
            >
              <StatusDot tone={p.health === "healthy" ? "ok" : p.health === "warning" ? "warn" : "bad"} pulse={p.health !== "healthy"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-100">{p.label}</span>
                  <span
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                      p.health === "healthy" ? "bg-emerald-500/12 text-emerald-300" : p.health === "warning" ? "bg-amber-500/12 text-amber-300" : "bg-rose-500/12 text-rose-300",
                    )}
                  >
                    {p.metric ?? p.health}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{p.detail}</p>
              </div>
              <ArrowUpRight size={14} className="mt-0.5 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </Panel>

      {/* Live risk map */}
      <Panel>
        <PanelHeader
          title="Live Risk Map"
          subtitle="Every evaluated entity, ranked by its worst deterministic risk finding"
          icon={<ShieldAlert size={14} />}
          action={
            <div className="flex gap-2">
              <BadgeTone tone="bad">{risk.counts.critical} critical</BadgeTone>
              <BadgeTone tone="warn">{risk.counts.high + risk.counts.medium} at risk</BadgeTone>
            </div>
          }
        />
        <div className="p-4 pt-3">
          <RiskMap risk={risk} />
          <p className="mt-3 text-[11px] text-slate-500">
            Expand any card to see the exact rule and reasoning behind its risk level — no unexplained red badges.
          </p>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Critical alerts */}
        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Critical Alerts"
            subtitle="Requires an owner decision"
            icon={<AlertTriangle size={14} />}
            action={<BadgeTone tone="bad">{critical.length} critical</BadgeTone>}
          />
          <div className="space-y-2 p-4">
            {critical.map((a) => (
              <AlertCard key={a.id} alert={a} onAcknowledge={acknowledgeAlert} />
            ))}
            {critical.length === 0 ? <p className="py-4 text-center text-sm text-emerald-300">No critical alerts — all clear.</p> : null}
            <div className="pt-2">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Warnings & info</div>
              <div className="space-y-2">
                {otherAlerts.map((a) => (
                  <AlertCard key={a.id} alert={a} onAcknowledge={acknowledgeAlert} compact />
                ))}
              </div>
            </div>
          </div>
        </Panel>

        {/* Department status */}
        <Panel>
          <PanelHeader title="Department Status" subtitle="Owner, workload and task pressure" icon={<Users2 size={14} />} />
          <div className="space-y-2 p-4">
            {teams.map((t) => {
              const total = t.openTasks + t.doneTasks || 1;
              return (
                <div key={t.teamId} className="rounded-xl border border-white/8 bg-white/3 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-200">{t.name}</span>
                    <StatusDot tone={t.status === "healthy" ? "ok" : t.status === "warning" ? "warn" : "bad"} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{t.leadName} · {t.volunteers} volunteers</span>
                    <span>{t.openTasks} open</span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={(t.doneTasks / total) * 100} tone={t.status === "critical" ? "bad" : t.status === "warning" ? "warn" : "ok"} height={5} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Upcoming ops */}
        <Panel>
          <PanelHeader title="Upcoming Operations" subtitle="Next sessions on the critical path" icon={<CalendarDays size={14} />} />
          <div className="space-y-2 p-4">
            {upcoming.map((s) => (
              <button
                key={s.id}
                onClick={() => setOpenSessionId(s.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-3 text-left hover:bg-white/6"
              >
                <div className="w-12 shrink-0 text-center">
                  <div className="font-mono text-sm text-slate-200">{timeOf(s.startsAt).split(" ")[0]}</div>
                  <div className="text-[10px] text-slate-500">{timeOf(s.startsAt).split(" ")[1]}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-200">{s.title}</div>
                  <div className="truncate text-[11px] text-slate-500">
                    {data.venues.find((v) => v.id === s.venueId)?.name} · {s.expectedAttendance.toLocaleString()} expected
                  </div>
                </div>
                <BadgeTone tone={s.status === "delayed" ? "bad" : s.riskLevel === "warning" ? "warn" : "blue"}>{s.status.replace("_", " ")}</BadgeTone>
              </button>
            ))}
          </div>
        </Panel>

        {/* Resource status */}
        <Panel>
          <PanelHeader
            title="Resource Status"
            subtitle="Allocation pressure across equipment"
            icon={<Boxes size={14} />}
            action={conflicts.length ? <BadgeTone tone="bad">{conflicts.length} conflicts</BadgeTone> : <BadgeTone tone="ok">balanced</BadgeTone>}
          />
          <div className="space-y-2 p-4">
            {data.resources.slice(0, 6).map((r) => {
              const over = r.assigned > r.available;
              return (
                <div key={r.id} className={cn("rounded-xl border border-white/8 bg-white/3 p-3", over && "border-l-2 border-l-rose-400")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-200">{r.name}</span>
                    <span className={cn("font-mono text-[11px]", over ? "text-rose-300" : "text-slate-500")}>
                      {r.assigned}/r{r.quantity} · {r.available} free
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={(r.assigned / r.quantity) * 100} tone={over ? "bad" : "blue"} height={5} />
                  </div>
                </div>
              );
            })}
            <Button size="sm" variant="ghost" className="w-full" onClick={() => navigate("/resources")}>
              All resources <ArrowUpRight size={13} />
            </Button>
          </div>
        </Panel>

        {/* Coverage + recent changes */}
        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Volunteer Coverage" subtitle="On-shift workload balance" icon={<UserSquare2 size={14} />} />
            <div className="p-4">
              <StackedBar
                segments={[
                  { value: load.underloaded, color: "#38bdf8", label: "Underloaded" },
                  { value: load.balanced, color: "#34d399", label: "Balanced" },
                  { value: load.overloaded, color: "#f87171", label: "Overloaded" },
                ]}
              />
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span><span className="text-rose-300">{load.overloaded}</span> overloaded</span>
                <span><span className="text-emerald-300">{load.balanced}</span> balanced</span>
                <span><span className="text-sky-300">{load.underloaded}</span> underloaded</span>
              </div>
              <div className="mt-3 space-y-1.5">
                {data.volunteers.filter((v) => v.workload >= 80).slice(0, 3).map((v) => (
                  <div key={v.id} className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/3 p-2">
                    <Avatar name={v.name} tone={v.avatarTone} size={24} />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{v.name}</span>
                    <span className="font-mono text-[11px] text-rose-300">{v.workload}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Recent Changes" subtitle="Event log (latest first)" icon={<History size={14} />} />
            <div className="space-y-1 p-4">
              {changes.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5 rounded-lg px-1 py-1.5">
                  <StatusDot tone={c.tone as "ok" | "warn" | "bad" | "ai" | "blue" | "neutral"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-slate-300">{c.text}</p>
                    <p className="text-[10px] text-slate-500">{relativeFromNow(c.at, NOW)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <SessionDrawer session={openSession} data={data} open={!!openSession} onClose={() => setOpenSessionId(null)} onSelectTask={() => navigate("/tasks")} />
    </div>
  );
}
