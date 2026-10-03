import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Database, Plug, Plus, RefreshCw } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { MEMORY_KIND_META } from "@/lib/memory";
import { NOTION_RELATION_COUNT } from "@/lib/notion/schema";
import { BadgeTone, Button, EmptyState, Panel, PanelHeader, SectionTitle } from "@/components/ui/primitives";
import { StatChip } from "@/components/ui/StateBlocks";
import { relativeFromNow } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { MemoryKind } from "@/types";

/**
 * KNOWLEDGE LAYER (Part 3)
 * ======================================================================
 * - NEXUS MEMORY: lessons, incidents, decisions, workflows and notes captured
 *   from the event and reusable for the next one.
 * - Knowledge items indexed for the copilot.
 * - Live link to the Notion wizard + sync center.
 */

const MEMORY_KINDS: MemoryKind[] = ["lesson", "incident", "decision", "workflow_success", "workflow_failure", "note"];

export function Knowledge() {
  const { data, memories, registerMemory } = useNexus();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<MemoryKind | "all">("all");
  const [draft, setDraft] = useState({ title: "", body: "", kind: "lesson" as MemoryKind, source: "Post-event report" });
  const [showForm, setShowForm] = useState(false);

  const filtered = filter === "all" ? memories : memories.filter((m) => m.kind === filter);
  const reusable = memories.filter((m) => m.reusable).length;

  const add = () => {
    if (!draft.title.trim()) return;
    registerMemory({
      kind: draft.kind,
      title: draft.title.trim(),
      body: draft.body.trim() || "Captured during the event.",
      source: draft.source.trim() || "Manual entry",
      tags: [draft.kind],
      related: [],
      reusable: true,
    });
    setDraft({ title: "", body: "", kind: "lesson", source: "Post-event report" });
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Knowledge Layer"
        title="NEXUS Memory & Knowledge"
        description="What happened becomes reusable knowledge. Captured memories are written into the NEXUS Knowledge database on the next Notion sync."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("/sync")}>
              <RefreshCw size={13} /> Sync Center
            </Button>
            <Button size="sm" variant="ai" onClick={() => navigate("/notion")}>
              <Plug size={13} /> Notion Wizard
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatChip label="Memories" value={memories.length} tone="ai" />
        <StatChip label="Reusable" value={reusable} tone="ok" />
        <StatChip label="Knowledge items" value={data.knowledge.length} tone="blue" />
        <StatChip label="Relations mapped" value={NOTION_RELATION_COUNT} tone="neutral" />
      </div>

<div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="NEXUS Memory"
            subtitle="Lessons, decisions and workflows captured from the event"
            icon={<Brain size={14} />}
            action={
              <Button size="sm" variant="ai" onClick={() => setShowForm((s) => !s)}>
                <Plus size={13} /> Capture
              </Button>
            }
          />

          {showForm ? (
            <div className="mx-4 mb-2 space-y-2 rounded-xl border border-violet-400/20 bg-violet-500/6 p-3">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="What should the team remember? e.g. 'Main stage AV check should begin 45 minutes before opening'"
                className="w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
              <textarea
                value={draft.body}
                onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                placeholder="Why it matters / how to apply it next time"
                rows={2}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={draft.kind}
                  onChange={(e) => setDraft({ ...draft, kind: e.target.value as MemoryKind })}
                  className="rounded-lg border border-white/10 bg-ink-850 px-2 py-1.5 text-xs text-slate-200"
                >
                  {MEMORY_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {MEMORY_KIND_META[k].label}
                    </option>
                  ))}
                </select>
                <input
                  value={draft.source}
                  onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/4 px-2 py-1.5 text-xs text-slate-200"
                />
                <Button size="sm" variant="ai" onClick={add}>
                  Save memory
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            <button
              onClick={() => setFilter("all")}
              className={cn("rounded-full border px-2.5 py-1 text-[11px]", filter === "all" ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/4 text-slate-400")}
            >
              All {memories.length}
            </button>
            {MEMORY_KINDS.map((k) => {
              const n = memories.filter((m) => m.kind === k).length;
              return (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={cn("rounded-full border px-2.5 py-1 text-[11px]", filter === k ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/4 text-slate-400")}
                >
                  {MEMORY_KIND_META[k].label} {n || ""}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 p-4 pt-2">
            {filtered.map((m) => (
              <div key={m.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-slate-100">{m.title}</span>
                  <BadgeTone tone={MEMORY_KIND_META[m.kind].tone}>{MEMORY_KIND_META[m.kind].label}</BadgeTone>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{m.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                  <span className="rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5">SOURCE: {m.source}</span>
                  {m.reusable ? <BadgeTone tone="ok">reusable</BadgeTone> : null}
                  {m.notionPageId ? <span className="inline-flex items-center gap-1"><Database size={9} /> notion:{m.notionPageId}</span> : null}
                  <span>captured {relativeFromNow(m.capturedAt, "2026-11-15T14:20:00")}</span>
                </div>
                {m.related.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.related.map((r) => (
                      <span key={`${r.kind}-${r.id}`} className="rounded-md border border-emerald-400/20 bg-emerald-500/8 px-1.5 py-0.5 text-[10px] text-emerald-200">
                        {r.kind}: {r.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {filtered.length === 0 ? <EmptyState title="No memories in this category" hint="Capture a lesson after the event." /> : null}
          </div>
        </Panel>

<div className="space-y-5">
          <Panel>
            <PanelHeader title="Knowledge items" subtitle="Indexed playbooks" icon={<Database size={14} />} />
            <div className="space-y-2 p-4">
              {data.knowledge.map((k) => (
                <div key={k.id} className="rounded-xl border border-white/8 bg-white/3 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-200">{k.title}</span>
                    <BadgeTone tone="ai">{k.category}</BadgeTone>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{k.summary}</p>
                  <div className="mt-1 text-[10px] text-slate-500">notion:{k.notionPageId}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Next event" subtitle="How memory compounds" icon={<Brain size={14} />} />
            <div className="space-y-2 p-4 text-[11px] leading-relaxed text-slate-400">
              <p>
                Reusable memories are offered to the copilot and the recommendation engine when the next event is planned, so the
                same AV delay, badge backlog or shuttle peak does not repeat.
              </p>
              <p className="rounded-lg border border-violet-400/20 bg-violet-500/6 p-2.5 text-slate-300">
                &ldquo;Main stage AV check should begin 45 minutes before opening.&rdquo;
                <span className="mt-1 block text-[10px] text-violet-300">SOURCE: Post-event report</span>
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}