import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, ChevronDown, Database, GitBranch, HelpCircle, Send, ShieldCheck, Sparkles, User } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { answerQuestion, SUGGESTED_QUESTIONS } from "@/lib/copilot";
import { BadgeTone, Button, ComingNext, Panel, PanelHeader, SectionTitle, SourceBadge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import type { CopilotMessage, EntityRef } from "@/types";

const uid = () => `m-${Math.random().toString(36).slice(2, 9)}`;

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

export function Copilot() {
  const { data, graph, risk } = useNexus();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "intro",
      role: "assistant",
      content: "Ask me about your event, tasks, dependencies, risks or schedule.",
      source: "verified",
      confidence: 100,
      why: "NEXUS Copilot answers only from verified event records and the dependency graph.",
      sources: [],
      createdAt: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [openWhy, setOpenWhy] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    setMessages((prev) => [...prev, { id: uid(), role: "user", content: q, createdAt: new Date().toISOString() }]);
    setInput("");
    setThinking(true);
    window.setTimeout(() => {
      const ans = answerQuestion(q, data);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: ans.content,
          source: ans.source,
          citations: ans.citations,
          sources: ans.sources,
          confidence: ans.confidence,
          why: ans.why,
          createdAt: new Date().toISOString(),
        },
      ]);
      setThinking(false);
    }, 420);
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Intelligence"
        title="NEXUS Copilot"
        description="Grounded answers over the dependency graph, with confidence, sources and the reasoning behind each answer."
        action={<ComingNext label="LLM BACKEND — PART 3" />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="flex h-[680px] flex-col lg:col-span-2">
          <PanelHeader
            title="Conversation"
            subtitle="Deterministic reasoning over live event data"
            icon={<Bot size={14} />}
            action={<BadgeTone tone="ai"><Sparkles size={11} /> NEXUS COPILOT</BadgeTone>}
          />

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "")}>
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl border", m.role === "user" ? "border-white/12 bg-white/6 text-slate-300" : "border-violet-400/25 bg-violet-500/12 text-violet-300")}>
                  {m.role === "user" ? <User size={15} /> : <Bot size={15} />}
                </span>
                <div className={cn("min-w-0 max-w-[88%]", m.role === "user" ? "text-right" : "")}>
                  {m.role === "assistant" && m.source ? (
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <SourceBadge source={m.source} />
                      {typeof m.confidence === "number" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.confidence >= 90 ? "#34d399" : m.confidence >= 75 ? "#fbbf24" : "#f87171" }} />
                          {m.confidence}% confidence
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className={cn("rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed", m.role === "user" ? "border-white/12 bg-white/8 text-slate-100" : "border-white/10 bg-white/4 text-slate-200")}>
                    <MarkdownLite text={m.content} />
                  </div>

                  {m.role === "assistant" && m.why ? (
                    <div className="mt-2">
                      <button
                        onClick={() => setOpenWhy((w) => (w === m.id ? null : m.id))}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        <HelpCircle size={11} /> Why? <ChevronDown size={11} className={cn("transition-transform", openWhy === m.id && "rotate-180")} />
                      </button>
                      {openWhy === m.id ? (
                        <p className="mt-2 rounded-lg border border-white/8 bg-white/3 px-2.5 py-2 text-[11px] leading-relaxed text-slate-400">
                          {m.why}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {m.sources && m.sources.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.sources.map((s) => (
                        <SourceChip key={`${s.kind}-${s.id}`} source={s} onClick={() => navigate(ROUTE_FOR_KIND[s.kind] ?? "/command")} />
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {thinking ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.2s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.1s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" />
                Traversing the dependency graph…
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-white/8 p-3">
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[11px] text-slate-300 transition-colors hover:border-violet-400/30 hover:bg-violet-500/10 hover:text-violet-200"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask(input)}
                placeholder="Ask about risk, dependencies, coverage or a specific record…"
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
              />
              <Button size="sm" variant="ai" onClick={() => ask(input)} disabled={!input.trim()}>
                <Send size={13} /> Send
              </Button>
            </div>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Grounding Contract" subtitle="How answers are labelled" icon={<ShieldCheck size={14} />} />
            <div className="space-y-3 p-4">
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/6 p-3">
                <SourceBadge source="verified" />
                <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                  Computed directly from event records. Every claim carries clickable source chips and a confidence value.
                </p>
              </div>
              <div className="rounded-xl border border-violet-400/20 bg-violet-500/6 p-3">
                <SourceBadge source="generated" />
                <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
                  A projection or narrative over the graph. Confidence is shown and the underlying records are still cited —
                  but the statement itself is not a confirmed fact.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/3 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">When data is missing</div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  NEXUS replies "I don't have enough verified event data to answer this" instead of inventing operational
                  facts, and explains what it looked for.
                </p>
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Graph Context" subtitle="What the copilot reasons over" icon={<GitBranch size={14} />} />
            <div className="space-y-2 p-4">
              <ContextRow label="Graph nodes" value={Object.keys(graph.nodes).length} />
              <ContextRow label="Graph edges" value={graph.edges.length} />
              <ContextRow label="Risk findings" value={risk.findings.length} />
              <ContextRow label="Critical risk nodes" value={risk.counts.critical} tone="bad" />
              <div className="mt-1 space-y-1.5">
                {[
                  ["Detection rules", "9 deterministic"],
                  ["Impact engine", "weighted BFS"],
                  ["Recommendation scoring", "5 inputs"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{k}</span>
                    <span className="text-slate-400">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Available Records" subtitle="Live dataset volume" icon={<Database size={14} />} />
            <div className="space-y-2 p-4">
              {[
                ["Sessions", data.sessions.length],
                ["Tasks", data.tasks.length],
                ["Volunteers", data.volunteers.length],
                ["Resources", data.resources.length],
                ["Dependencies", data.dependencies.length],
                ["Incidents", data.incidents.length],
              ].map(([label, n]) => (
                <ContextRow key={String(label)} label={String(label)} value={Number(n)} />
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SourceChip({ source, onClick }: { source: EntityRef; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-md border border-emerald-400/20 bg-emerald-500/8 px-1.5 py-0.5 text-[10px] text-emerald-200 transition-colors hover:bg-emerald-500/16"
      title="Open the module containing this record"
    >
      ✓ {source.kind}: {source.label}
    </button>
  );
}

function ContextRow({ label, value, tone }: { label: string; value: number; tone?: "bad" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/8 bg-white/3 px-3 py-2">
      <span className="text-xs text-slate-300">{label}</span>
      <span className={cn("font-mono text-xs", tone === "bad" ? "text-rose-300" : "text-slate-400")}>{value}</span>
    </div>
  );
}

/** Minimal markdown: **bold**, bullet lists and newlines. */
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const isBullet = line.trim().startsWith("- ") || /^\d+\.\s/.test(line.trim());
        const clean = isBullet ? line.trim().replace(/^(-\s|\d+\.\s)/, "") : line;
        const parts = clean.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className={cn("text-sm leading-relaxed", isBullet && "pl-3")}>
            {isBullet ? <span className="mr-1.5 text-slate-500">•</span> : null}
            {parts.map((p, j) =>
              p.startsWith("**") && p.endsWith("**") ? (
                <strong key={j} className="font-semibold text-slate-100">{p.slice(2, -2)}</strong>
              ) : (
                <span key={j}>{p}</span>
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}
