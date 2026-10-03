import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { buildReplay } from "@/lib/replay";
import { BadgeTone, Button, Panel, PanelHeader, SectionTitle, SeverityBadge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { ReplayKind } from "@/types";

/**
 * EVENT REPLAY (Part 3)
 * The event as a scrubbable timeline — the strong visual storytelling feature.
 * Merges the scripted narrative with live activity and incident records.
 */

const KIND_META: Record<ReplayKind, { tone: "ok" | "warn" | "bad" | "ai" | "blue" | "neutral"; icon: string }> = {
  start: { tone: "ok", icon: "▶" },
  delay: { tone: "warn", icon: "⏱" },
  ai: { tone: "ai", icon: "✦" },
  reassign: { tone: "blue", icon: "⇄" },
  request: { tone: "warn", icon: "?" },
  simulation: { tone: "ai", icon: "◈" },
  approval: { tone: "ok", icon: "✓" },
  incident: { tone: "bad", icon: "!" },
  sync: { tone: "neutral", icon: "↻" },
  resolve: { tone: "ok", icon: "✔" },
};

function toneRing(tone: "ok" | "warn" | "bad" | "ai" | "blue" | "neutral") {
  switch (tone) {
    case "ok":
      return "border-emerald-400/30 bg-emerald-500/12 text-emerald-300";
    case "warn":
      return "border-amber-400/30 bg-amber-500/12 text-amber-300";
    case "bad":
      return "border-rose-400/30 bg-rose-500/12 text-rose-300";
    case "ai":
      return "border-violet-400/30 bg-violet-500/14 text-violet-300";
    case "blue":
      return "border-sky-400/30 bg-sky-500/12 text-sky-300";
    default:
      return "border-white/15 bg-white/6 text-slate-300";
  }
}

export function Replay() {
  const { data } = useNexus();
  const navigate = useNavigate();
  const events = useMemo(() => buildReplay(data), [data]);

  const [cursor, setCursor] = useState(events.length);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => {
      setCursor((c) => {
        if (c >= events.length) {
          window.clearInterval(t);
          setPlaying(false);
          return c;
        }
        return c + 1;
      });
    }, 1100);
    return () => window.clearInterval(t);
  }, [playing, events.length]);

  const visible = events.slice(0, cursor);
  const done = cursor >= events.length;

return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Operations"
        title="Event Replay"
        description="The whole day as one timeline: human decisions, AI detections, impact simulations and approvals."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setCursor(0); setPlaying(true); }} disabled={playing}>
              <RotateCcw size={13} /> Restart
            </Button>
            <Button size="sm" variant={playing ? "outline" : "ai"} onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? "Pause" : done ? "Replay" : "Play"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCursor(events.length); setPlaying(false); }}>
              <SkipForward size={13} /> Skip to end
            </Button>
          </div>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <input
            type="range"
            min={0}
            max={events.length}
            value={cursor}
            onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }}
            className="h-1.5 min-w-[200px] flex-1 accent-violet-400"
            aria-label="Replay position"
          />
          <span className="font-mono text-xs text-slate-400">
            {cursor}/{events.length} events
          </span>
          {done ? <BadgeTone tone="ok">complete</BadgeTone> : <BadgeTone tone="ai">replaying</BadgeTone>}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel>
            <PanelHeader title="Timeline" subtitle="Chronological operational story" icon={<Play size={14} />} />
            <div className="relative p-4">
              <div className="absolute bottom-6 left-[92px] top-6 w-px bg-white/10" />
              <div className="space-y-3">
                {visible.map((e, i) => {
                  const meta = KIND_META[e.kind];
                  const isNew = i === visible.length - 1 && !done;
                  return (
                    <div key={e.id} className={cn("flex gap-4", isNew && "animate-rise")}>
                      <div className="w-14 shrink-0 pt-1 text-right font-mono text-xs text-slate-500">{e.at}</div>
                      <div className="relative z-10 flex flex-col items-center pt-1.5">
                        <span className={cn("grid h-6 w-6 place-items-center rounded-full border text-[11px]", toneRing(meta.tone), isNew && "ai-glow")}>
                          {meta.icon}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 rounded-xl border border-white/8 bg-white/3 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-100">{e.title}</span>
                          {e.severity ? <SeverityBadge severity={e.severity} /> : null}
                          <BadgeTone tone={meta.tone}>{e.kind.replace("_", " ")}</BadgeTone>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{e.detail}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                          {e.actor ? <span>actor: {e.actor}</span> : null}
                          {e.related?.map((r) => (
                            <span key={`${r.kind}-${r.id}`} className="rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5">
                              {r.kind}: {r.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {visible.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">Press play to replay the event.</p> : null}
              </div>
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Story beats" subtitle="Why this matters" icon={<ArrowRight size={14} />} />
          <div className="space-y-3 p-4 text-[11px] leading-relaxed text-slate-400">
            <p className="rounded-lg border border-white/8 bg-white/3 p-2.5">
              <span className="block text-slate-300">Change happens</span>
              The main venue becomes unavailable.
            </p>
            <p className="rounded-lg border border-violet-400/20 bg-violet-500/6 p-2.5">
              <span className="block text-slate-300">NEXUS understands relationships</span>
              The dependency graph finds the blast radius, the risk engine explains it and AI recommends actions.
            </p>
            <p className="rounded-lg border border-emerald-400/20 bg-emerald-500/6 p-2.5">
              <span className="block text-slate-300">Human approves</span>
              NEXUS updates the operational records, writes them back to Notion, and captures the lesson as reusable knowledge.
            </p>
            <Button size="sm" variant="ai" className="w-full" onClick={() => navigate("/impact")}>
              Open Impact Simulator
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}