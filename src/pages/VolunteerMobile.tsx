import { useState } from "react";
import { Bell, Check, MapPin, MessageCircle, Send, Sparkles, User, Clock } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { announcementsFor, myTasks, shiftFor } from "@/lib/volunteerShifts";
import { answerQuestion } from "@/lib/copilot";
import { BadgeTone, Button, Panel, PanelHeader, StatusBadge } from "@/components/ui/primitives";
import { AiBasis } from "@/components/domain/SourceBar";
import { timeOf } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * VOLUNTEER MOBILE VIEW (Part 3) — a deliberately mobile-first surface.
 * Shows MY SHIFT, MY TASKS (tickable) and an inline "Ask NEXUS" assistant that
 * answers strictly from the event data.
 */

const VOLUNTEER_ID = "v1";

export function VolunteerMobile() {
  const { data, setTaskStatus } = useNexus();
  const shift = shiftFor(data, VOLUNTEER_ID);
  const tasks = myTasks(data, VOLUNTEER_ID);
  const announcements = announcementsFor(data, VOLUNTEER_ID);
  const volunteer = data.volunteers.find((v) => v.id === VOLUNTEER_ID);

  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([
    { role: "assistant", text: "Hi! Ask me anything about today — where to report, what your tasks are, or who to contact." },
  ]);
  const [input, setInput] = useState("");

  const ask = (q: string) => {
    const question = q.trim();
    if (!question) return;
    const answer = answerQuestion(question, data);
    setMessages((prev) => [...prev, { role: "user", text: question }, { role: "assistant", text: answer.content }]);
    setInput("");
  };

  if (!shift) return <p className="text-sm text-slate-400">No shift assigned.</p>;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-sky-500/30 to-violet-700/30 text-sky-200">
          <User size={18} />
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-50">{volunteer?.name ?? "Volunteer"}</div>
          <div className="text-[11px] text-slate-500">{volunteer?.role} · {data.event.name}</div>
        </div>
      </div>

      <Panel className="overflow-hidden">
        <PanelHeader title="My shift" icon={<Clock size={14} />} action={<BadgeTone tone="ok">ON DUTY</BadgeTone>} />
        <div className="p-4">
          <div className="text-xl font-bold text-slate-50">
            {shift.start} – {shift.end}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-300">
            <MapPin size={14} className="text-slate-500" /> {shift.venue}
          </div>
          <p className="mt-3 rounded-lg border border-white/8 bg-white/3 p-2.5 text-[11px] text-slate-400">{shift.briefing}</p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="My tasks" subtitle={`${tasks.filter((t) => t.status === "completed").length}/${tasks.length} done`} icon={<Check size={14} />} />
        <div className="space-y-2 p-4">
          {tasks.map((t) => {
            const done = t.status === "completed";
            return (
              <button
                key={t.id}
                onClick={() => setTaskStatus(t.id, done ? "in_progress" : "completed")}
                className="flex w-full items-start gap-3 rounded-xl border border-white/8 bg-white/3 p-3 text-left transition-colors hover:bg-white/6"
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px]",
                    done ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-300" : "border-white/15 text-transparent",
                  )}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", done ? "text-slate-400 line-through" : "text-slate-100")}>{t.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    <StatusBadge status={t.status} />
                    {t.sessionId ? <span>{data.sessions.find((s) => s.id === t.sessionId)?.title}</span> : null}
                    <span>due {timeOf(t.deadline)}</span>
                  </span>
                </span>
              </button>
            );
          })}
          {tasks.length === 0 ? <p className="py-4 text-center text-xs text-slate-500">No tasks assigned yet — check with your coordinator.</p> : null}
        </div>
      </Panel>

<Panel>
        <PanelHeader
          title="Ask NEXUS"
          subtitle="Grounded answers from event data"
          icon={<MessageCircle size={14} />}
          action={<BadgeTone tone="ai"><Sparkles size={10} /> AI</BadgeTone>}
        />
        <div className="space-y-2.5 p-4">
          <div className="max-h-64 space-y-2.5 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12px] leading-relaxed",
                    m.role === "user" ? "bg-sky-500/20 text-sky-50" : "border border-white/8 bg-white/4 text-slate-200",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Where do I report?", "What are my tasks?", "Who is my coordinator?"].map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/10"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask(input)}
              placeholder="Ask a question…"
              className="flex-1 rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <Button variant="primary" size="sm" onClick={() => ask(input)}>
              <Send size={14} />
            </Button>
          </div>
          <AiBasis basis={["tasks", "sessions", "volunteers"]} note="answers cite verified records" />
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Announcements" icon={<Bell size={14} />} />
        <div className="space-y-2 p-4">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/8 bg-white/3 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-200">{a.subject}</span>
                <BadgeTone tone="neutral">{a.channel}</BadgeTone>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500">
                {a.audience} · {a.status} · {timeOf(a.scheduledAt)}
              </div>
            </div>
          ))}
          {announcements.length === 0 ? <p className="text-xs text-slate-500">No announcements.</p> : null}
        </div>
      </Panel>
    </div>
  );
}