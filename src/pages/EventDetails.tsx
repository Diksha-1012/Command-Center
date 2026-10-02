import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, CalendarDays, GitBranch, MapPin, Users2 } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { EVENT_DATE_LABEL } from "@/data/seed";
import { eventHealthScore, healthLabel, teamRollups } from "@/lib/selectors";
import { HealthMetricBars, RadialGauge } from "@/components/ui/charts";
import { BadgeTone, Button, Panel, PanelHeader, ProgressBar, SectionTitle, StatusDot } from "@/components/ui/primitives";
import { SessionDrawer } from "@/components/domain/SessionDrawer";
import { timeOf } from "@/lib/format";
import { cn } from "@/lib/cn";

export function EventDetails() {
  const { eventId } = useParams();
  const { data } = useNexus();
  const navigate = useNavigate();
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  if (eventId !== data.event.id) {
    return (
      <Panel className="p-10 text-center">
        <p className="text-slate-300">Event not found in this workspace.</p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("/events")}>
          <ArrowLeft size={14} /> Back to events
        </Button>
      </Panel>
    );
  }

  const health = eventHealthScore(data);
  const teams = teamRollups(data);
  const sessions = [...data.sessions].sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
  const openSession = data.sessions.find((s) => s.id === openSessionId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={() => navigate("/events")}>
          <ArrowLeft size={14} /> Events
        </Button>
        <span className="text-slate-600">/</span>
        <span className="text-sm text-slate-400">{data.event.name}</span>
      </div>

      <SectionTitle
        eyebrow="Event dossier"
        title={data.event.name}
        description={data.event.tagline}
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("/command")}>Command Center</Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/impact")}>Impact Simulator</Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <Panel className="lg:col-span-1">
          <PanelHeader title="Health Score" icon={<CalendarDays size={14} />} />
          <div className="grid place-items-center py-5">
            <RadialGauge value={health} label={healthLabel(health)} sublabel="composite" />
          </div>
          <div className="px-4 pb-4">
            <HealthMetricBars metrics={data.healthMetrics} />
          </div>
        </Panel>

        <Panel className="lg:col-span-3">
          <PanelHeader title="Operational Snapshot" icon={<MapPin size={14} />} />
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Date" value={EVENT_DATE_LABEL} />
            <Stat label="Primary venue" value={data.venues.find((v) => v.id === data.event.venueId)?.name ?? "—"} />
            <Stat label="Participants" value={data.event.participantTarget.toLocaleString()} />
            <Stat label="Programme items" value={String(data.event.programmeItems)} />
            <Stat label="Sessions" value={String(data.sessions.length)} />
            <Stat label="Volunteer pool" value={String(data.event.volunteerPool)} />
            <Stat label="Dependencies tracked" value={String(data.dependencies.length)} />
            <Stat label="Active alerts" value={String(data.alerts.filter((a) => !a.acknowledged).length)} />
          </div>
          <div className="border-t border-white/8 px-4 py-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Organizers</div>
            <div className="flex flex-wrap gap-2">
              {data.event.organizers.map((o) => (
                <BadgeTone key={o} tone="neutral">{o}</BadgeTone>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Venues" subtitle="Capacity and live load" icon={<Building2 size={14} />} />
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.venues.map((v) => (
            <div key={v.id} className={cn("rounded-xl border border-white/8 bg-white/3 p-3", v.status !== "healthy" && "border-l-2", v.status === "warning" && "border-l-amber-400", v.status === "critical" && "border-l-rose-400")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-200">{v.name}</div>
                  <div className="text-[11px] text-slate-500">{v.building} · cap {v.capacity.toLocaleString()}</div>
                </div>
                <StatusDot tone={v.status === "healthy" ? "ok" : v.status === "warning" ? "warn" : "bad"} />
              </div>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-[10px] text-slate-500"><span>utilization</span><span className="font-mono">{v.utilization}%</span></div>
                <ProgressBar value={v.utilization} tone={v.status === "critical" ? "bad" : v.status === "warning" ? "warn" : "ok"} height={5} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {v.features.map((f) => (
                  <span key={f} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{f}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Session Roster" subtitle="Click a session for full operational detail" icon={<CalendarDays size={14} />} />
          <div className="space-y-2 p-4">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setOpenSessionId(s.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-3 text-left hover:bg-white/6"
              >
                <div className="w-16 shrink-0">
                  <div className="font-mono text-sm text-slate-200">{timeOf(s.startsAt)}</div>
                  <div className="text-[10px] text-slate-500">→ {timeOf(s.endsAt)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-200">{s.title}</div>
                  <div className="truncate text-[11px] text-slate-500">
                    {data.venues.find((v) => v.id === s.venueId)?.name} · {data.teams.find((t) => t.id === s.teamId)?.name}
                  </div>
                </div>
                <BadgeTone tone={s.status === "delayed" ? "bad" : s.status === "live" ? "ok" : s.status === "completed" ? "neutral" : "blue"}>
                  {s.status.replace("_", " ")}
                </BadgeTone>
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Teams" subtitle="Ownership & pressure" icon={<Users2 size={14} />} />
          <div className="space-y-2 p-4">
            {teams.map((t) => (
              <div key={t.teamId} className="rounded-xl border border-white/8 bg-white/3 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-200">{t.name}</span>
                  <BadgeTone tone={t.status === "healthy" ? "ok" : t.status === "warning" ? "warn" : "bad"}>{t.status}</BadgeTone>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">{t.leadName} · {t.volunteers} volunteers · {t.openTasks} open tasks</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Dependency Edges" subtitle="Declared relationships feeding the impact engine" icon={<GitBranch size={14} />} />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {data.dependencies.map((dep) => (
            <div key={dep.id} className={cn("rounded-xl border border-white/8 bg-white/3 p-3 border-l-2", dep.severity === "critical" ? "border-l-rose-400" : dep.severity === "warning" ? "border-l-amber-400" : "border-l-sky-400")}>
              <div className="flex items-center gap-2">
                <BadgeTone tone={dep.severity === "critical" ? "bad" : dep.severity === "warning" ? "warn" : "blue"}>{dep.type.replace("_", " ")}</BadgeTone>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                <span className="rounded-md bg-white/5 px-1.5 py-0.5">{dep.source.label}</span>
                <span className="text-slate-600">→</span>
                <span className="rounded-md bg-white/5 px-1.5 py-0.5">{dep.target.label}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">{dep.description}</p>
            </div>
          ))}
        </div>
      </Panel>

      <SessionDrawer session={openSession} data={data} open={!!openSession} onClose={() => setOpenSessionId(null)} onSelectTask={() => navigate("/tasks")} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-200">{value}</div>
    </div>
  );
}
