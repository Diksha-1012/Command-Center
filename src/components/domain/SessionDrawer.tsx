import { Clock, MapPin, Users2, Package, GitBranch, ListChecks, CalendarCheck } from "lucide-react";
import type { NexusData, Session } from "@/types";
import { Drawer } from "@/components/ui/Overlay";
import { Avatar, BadgeTone, KeyValue, ProgressBar, SeverityBadge, StatusBadge } from "@/components/ui/primitives";
import { timeOf } from "@/lib/format";
import { dependenciesTouching } from "@/lib/selectors";

const SESSION_TONE = {
  scheduled: "blue",
  live: "ok",
  delayed: "warn",
  completed: "neutral",
  at_risk: "bad",
} as const;

export function SessionDrawer({
  session,
  data,
  open,
  onClose,
  onSelectTask,
}: {
  session: Session | null;
  data: NexusData;
  open: boolean;
  onClose: () => void;
  onSelectTask?: (taskId: string) => void;
}) {
  if (!session) return null;
  const venue = data.venues.find((v) => v.id === session.venueId);
  const team = data.teams.find((t) => t.id === session.teamId);
  const speakers = data.speakers.filter((s) => session.speakerIds.includes(s.id));
  const resources = data.resources.filter((r) => session.resourceIds.includes(r.id));
  const tasks = data.tasks.filter((t) => t.sessionId === session.id);
  const deps = dependenciesTouching(data, "session", session.id);
  const progress = tasks.length
    ? tasks.reduce((n, t) => n + t.progress, 0) / tasks.length
    : session.status === "completed"
      ? 100
      : 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={session.title}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <BadgeTone tone={SESSION_TONE[session.status]}>{session.status.replace("_", " ")}</BadgeTone>
          <span className="text-slate-500">·</span>
          <span>{session.track} track</span>
        </span>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/8 bg-white/3 p-3">
            <KeyValue label="Time">
              <span className="inline-flex items-center gap-1.5">
                <Clock size={13} className="text-slate-500" /> {timeOf(session.startsAt)} – {timeOf(session.endsAt)}
              </span>
            </KeyValue>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/3 p-3">
            <KeyValue label="Venue">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-500" /> {venue?.name}
              </span>
            </KeyValue>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/3 p-3">
            <KeyValue label="Expected attendance">
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck size={13} className="text-slate-500" /> {session.expectedAttendance.toLocaleString()}
              </span>
            </KeyValue>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/3 p-3">
            <KeyValue label="Risk level">
              <SeverityBadge severity={session.riskLevel} />
            </KeyValue>
          </div>
        </div>

        {session.notes ? (
          <div className="rounded-xl border border-violet-400/15 bg-violet-500/6 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-violet-300">Operations note</div>
            <p className="mt-1 text-sm text-slate-300">{session.notes}</p>
          </div>
        ) : null}

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Users2 size={13} /> Team & speakers
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-500/12 text-sky-300">
                <Users2 size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-200">{team?.name}</div>
                <div className="text-[11px] text-slate-500">{team?.description}</div>
              </div>
              <BadgeTone tone={team?.status === "healthy" ? "ok" : team?.status === "warning" ? "warn" : "bad"}>
                {team?.status}
              </BadgeTone>
            </div>
            {speakers.map((sp) => (
              <div key={sp.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-2.5">
                <Avatar name={sp.name} tone={sp.avatarTone} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-200">{sp.name}</div>
                  <div className="text-[11px] text-slate-500">{sp.title} · {sp.org}</div>
                </div>
                <BadgeTone tone={sp.arrivalStatus === "confirmed" ? "ok" : sp.arrivalStatus === "delayed" ? "bad" : "warn"}>
                  {sp.arrivalStatus}
                </BadgeTone>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Package size={13} /> Allocated resources
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {resources.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/8 bg-white/3 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-200">{r.name}</span>
                  <span className="font-mono text-[11px] text-slate-500">{r.assigned}/{r.quantity}</span>
                </div>
                <div className="mt-2">
                  <ProgressBar value={(r.assigned / r.quantity) * 100} tone={r.assigned > r.available ? "bad" : "blue"} height={5} />
                </div>
              </div>
            ))}
            {resources.length === 0 ? <p className="text-xs text-slate-500">No equipment allocated.</p> : null}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <ListChecks size={13} /> Linked tasks ({tasks.length})
          </h4>
          <div className="mb-2">
            <ProgressBar value={progress} tone="blue" />
          </div>
          <div className="space-y-1.5">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTask?.(t.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-2.5 py-2 text-left hover:bg-white/6"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{t.title}</span>
                <StatusBadge status={t.status} />
              </button>
            ))}
            {tasks.length === 0 ? <p className="text-xs text-slate-500">No tasks linked to this session.</p> : null}
          </div>
        </div>

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <GitBranch size={13} /> Dependencies ({deps.length})
          </h4>
          <div className="space-y-2">
            {deps.map((dep) => (
              <div key={dep.id} className="rounded-xl border border-white/8 bg-white/3 p-2.5">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={dep.severity} />
                  <span className="text-[11px] uppercase tracking-wide text-slate-500">{dep.type.replace("_", " ")}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-300">
                  <span className="rounded-md bg-white/5 px-1.5 py-0.5">{dep.source.label}</span>
                  <span className="text-slate-600">→</span>
                  <span className="rounded-md bg-white/5 px-1.5 py-0.5">{dep.target.label}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{dep.description}</p>
              </div>
            ))}
            {deps.length === 0 ? <p className="text-xs text-slate-500">No dependency edges on this session.</p> : null}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
