import { Boxes, BrainCircuit, GitBranch, Layers, Lock, Network, Server, Workflow } from "lucide-react";
import { NOTION_DATABASES, NOTION_RELATION_COUNT } from "@/lib/notion/schema";
import { BadgeTone, Panel, PanelHeader, SectionTitle } from "@/components/ui/primitives";
import { Notice } from "@/components/ui/StateBlocks";
import { cn } from "@/lib/cn";

/**
 * ARCHITECTURE & STORY (Part 3)
 * In-app documentation: the layers, the data flow, the Notion integration, the
 * dependency engine, and the before/after NEXUS story.
 */

const LAYERS = [
  { icon: Layers, name: "Frontend", detail: "React 18 + Vite + TypeScript + Tailwind v4. Route-level pages read only from the store's selector layer." },
  { icon: Server, name: "Server layer", detail: "A Vite middleware proxy performs the authenticated Notion calls. No secret ever reaches the browser." },
  { icon: BrainCircuit, name: "AI layer", detail: "Deterministic reasoning + generated narratives, always labelled VERIFIED or AI GENERATED." },
  { icon: GitBranch, name: "Dependency engine", detail: "Typed graph of the event; weighted BFS produces the blast radius." },
  { icon: Boxes, name: "Data layer", detail: "In-memory operational store (reducer) with reset-to-seed; the durable copy is Notion." },
  { icon: Network, name: "Notion API", detail: `${NOTION_DATABASES.length} databases, ${NOTION_RELATION_COUNT} relation properties preserving the operational graph.` },
  { icon: Lock, name: "Authentication", detail: "Notion internal integration token (server env). QR join is deliberately auth-free for volunteers." },
  { icon: Workflow, name: "Sync flow", detail: "Push app → Notion, pull Notion → app, reconcile, then capture knowledge." },
];

const DATA_FLOW = [
  "Input",
  "Structured event data",
  "Dependency graph",
  "Risk engine",
  "AI reasoning",
  "Human approval",
  "Application state",
  "Notion synchronization",
  "Knowledge capture",
];

const STORY = [
  { stage: "BEFORE NEXUS", text: "Event information is fragmented — spreadsheets, WhatsApp, Google Forms, documents, calendars, messages." },
  { stage: "CHANGE HAPPENS", text: "The main venue changes." },
  { stage: "PROBLEM", text: "One change affects many operational elements." },
  { stage: "NEXUS", text: "Understands relationships." },
  { stage: "IMPACT ENGINE", text: "Finds the blast radius." },
  { stage: "AI", text: "Explains what changed and recommends actions." },
  { stage: "HUMAN", text: "Reviews and approves." },
  { stage: "NEXUS", text: "Updates operational records." },
  { stage: "NOTION", text: "Becomes the persistent knowledge layer." },
  { stage: "AFTER EVENT", text: "NEXUS converts what happened into reusable knowledge." },
];

export function Docs() {
  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="System"
        title="Architecture & Story"
        description="How NEXUS is put together, how data flows through it, and the story it tells."
      />

      <Panel>
        <PanelHeader title="Data flow" subtitle="Input → structured data → graph → risk → AI → approval → state → Notion → knowledge" icon={<Workflow size={14} />} />
        <div className="flex flex-wrap items-center gap-2 p-4">
          {DATA_FLOW.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className={cn("rounded-xl border px-3 py-2 text-xs", i >= 3 && i <= 5 ? "border-violet-400/25 bg-violet-500/8 text-violet-200" : i >= 6 ? "border-sky-400/25 bg-sky-500/8 text-sky-200" : "border-white/10 bg-white/4 text-slate-300")}>
                {step}
              </span>
              {i < DATA_FLOW.length - 1 ? <span className="text-slate-600">→</span> : null}
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Architecture" subtitle="Layers and responsibilities" icon={<Layers size={14} />} />
          <div className="space-y-2 p-4">
            {LAYERS.map((l) => {
              const Icon = l.icon;
              return (
                <div key={l.name} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/3 p-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/12 bg-white/5 text-slate-300">
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-200">{l.name}</div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{l.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <PanelHeader title="Dependency engine" subtitle="How the blast radius is computed" icon={<GitBranch size={14} />} />
            <div className="space-y-2 p-4 text-[11px] leading-relaxed text-slate-400">
              <p>Every domain entity becomes a typed node (status, risk, owner). Every relationship becomes a weighted edge.</p>
              <p>
                A venue change traverses INCOMING edges (dependents) transitively, and OUTGOING edges (requirements) one level deep —
                so speakers, resources, volunteers, tasks and communications surface without the whole graph collapsing.
              </p>
              <p>Confidence decays per hop; the impact score blends volume, type importance, peak risk and infrastructure weight.</p>
              <div className="flex flex-wrap gap-1.5">
                {["REQUIRES 0.95", "DEPENDS_ON 0.95", "LOCATED_AT 0.90", "USES 0.90", "AFFECTS 0.75", "ASSIGNED_TO 0.70"].map((k) => (
                  <BadgeTone key={k} tone="neutral">{k}</BadgeTone>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Notion integration" subtitle="Real API, server-side secrets" icon={<Network size={14} />} />
            <div className="space-y-2 p-4">
              <Notice tone="ok" title="Security">
                The token is read only by the server proxy from <code className="text-emerald-200">NOTION_TOKEN</code>. The client
                calls <code>/api/notion/*</code> and never holds a credential.
              </Notice>
              <div className="flex flex-wrap gap-1.5">
                {NOTION_DATABASES.map((d) => (
                  <span key={d.key} className="rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5 text-[10px] text-slate-300">
                    {d.icon} {d.name.replace("NEXUS ", "")}
                  </span>
                ))}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                When credentials are absent the app runs on labelled DEMO DATA with an identical sync model — it never claims demo
                data is live synchronization.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHeader title="The NEXUS story" subtitle="Before → change → problem → understanding → approval → knowledge" icon={<BrainCircuit size={14} />} />
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {STORY.map((s, i) => (
            <div key={s.stage} className={cn("rounded-xl border p-3", i === 0 ? "border-rose-400/25 bg-rose-500/6" : i >= 3 && i <= 5 ? "border-violet-400/25 bg-violet-500/6" : "border-emerald-400/25 bg-emerald-500/6")}>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.stage}</div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-white/8 px-4 py-4 text-center">
          <p className="text-sm font-medium text-slate-200">
            &ldquo;NEXUS doesn&rsquo;t just manage events. It understands how events work.&rdquo;
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Dependency intelligence · Impact simulation · AI operations copilot · Notion knowledge layer · Human-in-the-loop control
          </p>
        </div>
      </Panel>
    </div>
  );
}