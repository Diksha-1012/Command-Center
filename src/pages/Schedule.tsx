import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, GitBranch, MapPin, Users2 } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { NOW } from "@/data/seed";
import { BadgeTone, Button, Panel, PanelHeader, SectionTitle, StatusDot } from "@/components/ui/primitives";
import { SessionDrawer } from "@/components/domain/SessionDrawer";
import { timeOf } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { SessionStatus } from "@/types";

const DAY_START = 9;
const DAY_END = 23;

const SESSION_TONE: Record<SessionStatus, "ok" | "warn" | "bad" | "neutral" | "blue"> = {
  scheduled: "blue",
  live: "ok",
  delayed: "warn",
  completed: "neutral",
  at_risk: "bad",
};

const SESSION_BAR: Record<SessionStatus, string> = {
  scheduled: "from-sky-500/40 to-sky-500/15 border-sky-400/40",
  live: "from-emerald-500/45 to-emerald-500/15 border-emerald-400/50",
  delayed: "from-amber-500/45 to-amber-500/15 border-amber-400/50",
  completed: "from-slate-500/30 to-slate-500/10 border-slate-400/30",
  at_risk: "from-rose-500/45 to-rose-500/15 border-rose-400/50",
};

const toHours = (iso: string) => {
  const h = Number(iso.slice(11, 13));
  const m = Number(iso.slice(14, 16));
  return h + m / 60;
};

export function Schedule() {
  const { data } = useNexus();
  const navigate = useNavigate();
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...data.sessions].sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1)),
    [data.sessions],
  );

  const hours = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i);
  const span = DAY_END - DAY_START;
  const nowPct = ((toHours(NOW) - DAY_START) / span) * 100;
  const openSession = data.sessions.find((s) => s.id === openSessionId) ?? null;

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Programme"
        title="Event Schedule"
        description="Timeline and run-of-show. Click any block for the full operational detail."
        action={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <StatusDot tone="ok" pulse /> live marker at {timeOf(NOW)}
          </div>
        }
      />

      <Panel className="overflow-hidden">
        <PanelHeader title="Timeline" subtitle={`${DAY_START}:00 – ${DAY_END}:00 · ${ORDERED_NOTE}`} icon={<Clock size={14} />} />
        <div className="overflow-x-auto p-4">
          <div className="min-w-[900px]">
            <div className="relative mb-2 flex">
              {hours.slice(0, -1).map((h) => (
                <div key={h} className="flex-1 text-[10px] text-slate-600">
                  {h % 12 === 0 ? 12 : h % 12}{h >= 12 ? "pm" : "am"}
                </div>
              ))}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 flex w-full">
                {hours.slice(0, -1).map((h) => (
                  <div key={h} className="flex-1 border-l border-white/6" />
                ))}
              </div>
              <div className="absolute inset-y-0 z-20 w-px bg-emerald-400/70" style={{ left: `${nowPct}%` }}>
                <div className="absolute -top-1 -left-1.5 h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              </div>
              <div className="relative space-y-2 py-1">
                {ordered.map((s) => {
                  const start = ((toHours(s.startsAt) - DAY_START) / span) * 100;
                  const end = ((toHours(s.endsAt) - DAY_START) / span) * 100;
                  const width = Math.max(end - start, 4);
                  const venue = data.venues.find((v) => v.id === s.venueId);
                  const speaker = data.speakers.find((sp) => sp.id === s.speakerIds[0]);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setOpenSessionId(s.id)}
                      className="group relative block h-12 w-full text-left"
                      title={`${s.title} · ${timeOf(s.startsAt)}`}
                    >
                      <div
                        className={cn(
                          "absolute top-0 flex h-11 items-center gap-2 overflow-hidden rounded-lg border bg-gradient-to-r px-2.5 transition-all group-hover:brightness-125",
                          SESSION_BAR[s.status],
                        )}
                        style={{ left: `${start}%`, width: `${width}%` }}
                      >
                        <span className="truncate text-xs font-medium text-white/95">{s.title}</span>
                        <span className="hidden shrink-0 text-[10px] text-white/60 xl:inline">{venue?.name}</span>
                      </div>
                      <div className="pointer-events-none absolute top-[2px] text-[10px] text-slate-500" style={{ left: `${start}%`, transform: "translateY(-0px)" }}>
                        <span className="hidden">{speaker?.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Run of Show" subtitle="Every session with owner, venue and risk" icon={<Users2 size={14} />} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Time</th>
                <th className="px-4 py-2.5 font-semibold">Session</th>
                <th className="px-4 py-2.5 font-semibold">Venue</th>
                <th className="px-4 py-2.5 font-semibold">Speaker</th>
                <th className="px-4 py-2.5 font-semibold">Team</th>
                <th className="px-4 py-2.5 font-semibold">Deps</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((s) => {
                const venue = data.venues.find((v) => v.id === s.venueId);
                const team = data.teams.find((t) => t.id === s.teamId);
                const speakers = data.speakers.filter((sp) => s.speakerIds.includes(sp.id));
                const deps = data.dependencies.filter((dep) => dep.source.id === s.id || dep.target.id === s.id).length;
                return (
                  <tr
                    key={s.id}
                    onClick={() => setOpenSessionId(s.id)}
                    className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/4"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-slate-300">{timeOf(s.startsAt)}</div>
                      <div className="text-[10px] text-slate-500">→ {timeOf(s.endsAt)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-200">{s.title}</div>
                      <div className="text-[10px] text-slate-500">{s.track} · {s.expectedAttendance.toLocaleString()} expected</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5"><MapPin size={12} className="text-slate-600" />{venue?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{speakers.map((sp) => sp.name).join(", ") || "—"}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{team?.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                        <GitBranch size={10} /> {deps}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <BadgeTone tone={SESSION_TONE[s.status]}>{s.status.replace("_", " ")}</BadgeTone>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-white/8 px-4 py-3">
          <span className="text-[11px] text-slate-500">{data.sessions.length} headline sessions · {data.event.programmeItems} programme items total (incl. breakouts)</span>
          <Button size="sm" variant="ghost" onClick={() => navigate("/resources")}>Check resource conflicts</Button>
        </div>
      </Panel>

      <SessionDrawer session={openSession} data={data} open={!!openSession} onClose={() => setOpenSessionId(null)} onSelectTask={() => navigate("/tasks")} />
    </div>
  );
}

const ORDERED_NOTE = "click a block to inspect";
export default Schedule;
