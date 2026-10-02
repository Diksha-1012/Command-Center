import { useNavigate } from "react-router-dom";
import { ArrowUpRight, CalendarDays, MapPin, Sparkles, Ticket } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { EVENT_DATE_LABEL } from "@/data/seed";
import { computeKpis, eventHealthScore, healthLabel } from "@/lib/selectors";
import { BadgeTone, Button, DemoTag, Panel, ProgressBar, SectionTitle, StatusDot } from "@/components/ui/primitives";
import { RadialGauge } from "@/components/ui/charts";

const PAST_EVENTS = [
  { id: "ev-prev-1", name: "KINETEX HACKATHON 2025", date: "18 October 2025", venue: "KIIT Campus, Block C", participants: 940, sessions: 6, tasks: 58, health: 88 },
  { id: "ev-prev-2", name: "DEVSUMMIT STUDENT EDITION", date: "22 March 2026", venue: "KIIT Campus, Innovation Hall", participants: 610, sessions: 5, tasks: 41, health: 93 },
];

export function Events() {
  const { data } = useNexus();
  const navigate = useNavigate();
  const kpis = computeKpis(data);
  const health = eventHealthScore(data);

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Portfolio"
        title="Events"
        description="Every event NEXUS OPS is commanding, with live health and operational load."
      />

      <Panel className="relative overflow-hidden p-5">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative flex flex-wrap items-center gap-6">
          <RadialGauge value={health} label={healthLabel(health)} sublabel="event health" size={150} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <BadgeTone tone="ok"><StatusDot tone="ok" pulse /> LIVE</BadgeTone>
              <BadgeTone tone="ai"><Sparkles size={11} /> Dependency graph active</BadgeTone>
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-50">{data.event.name}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} /> {EVENT_DATE_LABEL}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> KIIT Campus</span>
              <span className="inline-flex items-center gap-1.5"><Ticket size={13} /> {data.event.organizers.join(" · ")}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Participants" value={kpis.participants.toLocaleString()} />
              <Metric label="Sessions" value={String(data.sessions.length)} />
              <Metric label="Volunteers" value={String(kpis.activeVolunteers)} />
              <Metric label="Tasks" value={`${kpis.tasksCompleted}/${kpis.tasksTotal}`} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => navigate(`/events/${data.event.id}`)}>
                Open event <ArrowUpRight size={14} />
              </Button>
              <Button variant="outline" onClick={() => navigate("/schedule")}>Schedule</Button>
              <Button variant="outline" onClick={() => navigate("/tasks")}>Task board</Button>
            </div>
          </div>
        </div>
      </Panel>

      <div>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Event Archive</h3>
          <DemoTag label="DEMO HISTORY" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {PAST_EVENTS.map((e) => (
            <Panel key={e.id} soft className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-200">{e.name}</div>
                  <div className="mt-1 text-[11px] text-slate-500">{e.date} · {e.venue}</div>
                </div>
                <BadgeTone tone={e.health >= 88 ? "ok" : "warn"}>{e.health}% health</BadgeTone>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] text-slate-400">
                <div><span className="font-mono text-slate-200">{e.participants.toLocaleString()}</span><div>participants</div></div>
                <div><span className="font-mono text-slate-200">{e.sessions}</span><div>sessions</div></div>
                <div><span className="font-mono text-slate-200">{e.tasks}</span><div>tasks</div></div>
              </div>
              <div className="mt-3">
                <ProgressBar value={e.health} tone={e.health >= 88 ? "ok" : "warn"} height={5} />
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                Post-event retrospective archived in the Notion knowledge layer.
              </p>
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-3 py-2">
      <div className="font-mono text-lg text-slate-100">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
