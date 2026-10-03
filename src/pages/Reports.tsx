import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BookMarked, Brain, ClipboardList, Download, FileText, Sparkles } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { generateEventReport } from "@/lib/reportGenerator";
import { BadgeTone, Button, EmptyState, Panel, PanelHeader, SectionTitle } from "@/components/ui/primitives";
import { AiGeneratedBadge, SourceChip, VerifiedBadge } from "@/components/domain/SourceBar";
import { StatChip } from "@/components/ui/StateBlocks";

/**
 * POST-EVENT AUTO REPORT (Part 3)
 * ======================================================================
 * One click turns the whole event into a retrospective: summary, attendance,
 * task completion, incidents, volunteer performance, resource usage, changes,
 * lessons and recommendations — with AI-generated sections clearly labelled and
 * links back to the source records.
 */

export function Reports() {
  const { data, memories, report, generateReport } = useNexus();
  const navigate = useNavigate();

  const preview = useMemo(() => report ?? generateEventReport(data, memories), [report, data, memories]);
  const generated = !!report;

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Intelligence"
        title="Post-Event Report"
        description="Generate the retrospective from verified event records. Narrative sections are labelled AI GENERATED and cite what they were derived from."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Download size={13} /> Print / Save
            </Button>
            <Button size="sm" variant="ai" onClick={() => generateReport()}>
              <Sparkles size={14} /> {generated ? "Regenerate report" : "Generate event report"}
            </Button>
          </div>
        }
      />

      {!generated ? (
        <Panel>
          <div className="grid place-items-center gap-3 px-6 py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border border-violet-400/25 bg-violet-500/10 text-violet-300">
              <FileText size={22} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-100">No report generated yet</p>
              <p className="mt-1 max-w-md text-xs text-slate-400">
                The preview below is computed live from the current dataset. Generate the report to snapshot it, then review the
                labelled sections.
              </p>
            </div>
            <Button variant="ai" onClick={() => generateReport()}>
              <Sparkles size={14} /> Generate event report
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel className="relative overflow-hidden p-5">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeTone tone="ai"><ClipboardList size={11} /> POST-EVENT REPORT</BadgeTone>
            {generated ? <BadgeTone tone="ok">snapshot generated</BadgeTone> : <BadgeTone tone="neutral">live preview</BadgeTone>}
          </div>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-50">{preview.title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">{preview.summary}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {preview.metrics.map((m) => (
              <StatChip key={m.label} label={m.label} value={m.value} tone={m.tone} />
            ))}
          </div>
        </div>
      </Panel>

<div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {preview.sections.map((s) => (
            <Panel key={s.id}>
              <PanelHeader
                title={s.title}
                icon={s.kind === "generated" ? <Sparkles size={14} /> : <BookMarked size={14} />}
                action={s.kind === "generated" ? <AiGeneratedBadge /> : <VerifiedBadge />}
              />
              <div className="space-y-2 p-4">
                <p className="text-sm leading-relaxed text-slate-300">{s.body}</p>
                {s.bullets?.length ? (
                  <ul className="space-y-1">
                    {s.bullets.map((b, i) => (
                      <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-slate-400">
                        <span className="mt-0.5 text-slate-600">•</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {s.sources?.length ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">Source records:</span>
                    {s.sources.slice(0, 6).map((r) => (
                      <SourceChip key={`${r.kind}-${r.id}`} kind={r.kind} label={r.label} />
                    ))}
                  </div>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>

        <Panel>
          <PanelHeader title="Recommendations" subtitle="Projected improvements" icon={<Brain size={14} />} action={<AiGeneratedBadge />} />
          <div className="space-y-2 p-4">
            {preview.recommendations.map((a) => (
              <div key={a.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-slate-100">{a.title}</span>
                  <BadgeTone tone={a.priority === "critical" ? "bad" : a.priority === "high" ? "warn" : "blue"}>{a.priority}</BadgeTone>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{a.detail}</p>
              </div>
            ))}
            {preview.recommendations.length === 0 ? <EmptyState title="Nothing outstanding" hint="No recommendations surfaced." /> : null}
            <Button size="sm" variant="ghost" className="w-full" onClick={() => navigate("/knowledge")}>
              Open NEXUS Memory
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}