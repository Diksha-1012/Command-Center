import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Database, RefreshCw, Server, Shield, Users2, Wand2 } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { BadgeTone, Button, Panel, PanelHeader, SectionTitle, StatusDot } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

const ROLES = [
  { name: "Event Organizer / Leadership", status: "active", note: "Overview, health, portfolio" },
  { name: "Operations Lead", status: "active", note: "Command Center, tasks, schedule" },
  { name: "Volunteer", status: "active", note: "Roster, coverage, workload" },
  { name: "Technical Lead", status: "modelled", note: "In domain; covered by the Organizer / Ops role switch" },
  { name: "Marketing / Comms Lead", status: "modelled", note: "In domain; covered by the Organizer / Ops role switch" },
  { name: "Volunteer Coordinator", status: "modelled", note: "In domain; covered by the Volunteer role view" },
];

export function Settings() {
  const { data, resetDemo } = useNexus();
  const navigate = useNavigate();
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Workspace"
        title="Settings"
        description="Workspace identity, role architecture, data sources and demo controls."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Event Workspace" subtitle="Identity and environment" icon={<Server size={14} />} />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Event name" value={data.event.name} />
            <Field label="Event date" value="15 November 2026" />
            <Field label="Primary venue" value={data.venues.find((v) => v.id === data.event.venueId)?.name ?? "—"} />
            <Field label="Organizers" value={data.event.organizers.join(" · ")} />
            <Field label="Environment" value="Demo dataset (in-memory) · Notion is the durable layer" />
            <Field label="Build" value="NEXUS OPS · v0.3 (Part 1–3)" />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Data Sources" subtitle="Where NEXUS reads from" icon={<Database size={14} />} />
          <div className="space-y-2 p-4">
            <SourceRow label="Local demo store" detail={`${data.tasks.length} tasks · ${data.sessions.length} sessions`} tone="ok" />
            <SourceRow label="Notion knowledge layer" detail={data.notion.connected ? `${data.notion.mode} mode · connected` : "demo mode · not connected"} tone={data.notion.connected ? "ok" : "warn"} />
            <SourceRow label="Backend API" detail="in-memory store (no backend)" tone="neutral" />
            <SourceRow label="AI engine" detail="grounded deterministic engine" tone="ok" />
            <div className="pt-1">
              <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("/knowledge")}>
                Manage Notion connection
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Role Architecture" subtitle="Six target users; three active as switchable roles" icon={<Users2 size={14} />} />
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.name} className={cn("rounded-xl border border-white/8 bg-white/3 p-3", r.status === "active" && "border-l-2 border-l-emerald-400")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-200">{r.name}</span>
                {r.status === "active" ? (
                  <BadgeTone tone="ok"><CheckCircle2 size={10} /> active</BadgeTone>
                ) : (
                  <BadgeTone tone="neutral">modelled</BadgeTone>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{r.note}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Interface" subtitle="Display preferences for this session" icon={<Wand2 size={14} />} />
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 p-3">
              <div>
                <div className="text-sm text-slate-200">Density</div>
                <div className="text-[11px] text-slate-500">Compact cards show more information per screen</div>
              </div>
              <div className="flex gap-1 rounded-lg border border-white/10 bg-white/4 p-1">
                {(["comfortable", "compact"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDensity(d)}
                    className={cn("rounded-md px-2.5 py-1 text-[11px]", density === d ? "bg-white/12 text-white" : "text-slate-400")}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/3 p-3">
              <div>
                <div className="text-sm text-slate-200">Reduced motion</div>
                <div className="text-[11px] text-slate-500">Disables pulse and rise animations in this session</div>
              </div>
              <button
                onClick={() => setReducedMotion((v) => !v)}
                className={cn("relative h-6 w-11 rounded-full border transition-colors", reducedMotion ? "border-emerald-400/40 bg-emerald-500/25" : "border-white/12 bg-white/8")}
                aria-pressed={reducedMotion}
              >
                <span className={cn("absolute top-0.5 rounded-full bg-white transition-all", reducedMotion ? "left-6" : "left-0.5")} style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Current: <span className="text-slate-300">{density}</span> density{reducedMotion ? " · reduced motion on" : ""}. Preferences are session-scoped for the demo.
            </p>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Demo Controls" subtitle="Reset the in-memory dataset for a clean pitch" icon={<RefreshCw size={14} />} />
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/6 p-3">
              <Shield size={15} className="mt-0.5 text-amber-300" />
              <p className="text-[11px] leading-relaxed text-slate-300">
                This resets every task status, alert acknowledgement and Notion sync state back to the seeded demo
                values. Use it before each judge demo run.
              </p>
            </div>
            <Button variant="outline" onClick={resetDemo}>
              <RefreshCw size={14} /> Reset demo dataset
            </Button>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <StatusDot tone="warn" /> State is in-memory for the session · the durable copy is Notion
            </div>
            <div className="pt-1">
              <BadgeTone tone="ok">RESET RE-SEEDS THE DEMO IN PLACE</BadgeTone>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-200">{value}</div>
    </div>
  );
}

function SourceRow({ label, detail, tone }: { label: string; detail: string; tone: "ok" | "warn" | "neutral" }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/3 p-2.5">
      <StatusDot tone={tone} />
      <span className="text-xs text-slate-300">{label}</span>
      <span className="ml-auto text-[10px] text-slate-500">{detail}</span>
    </div>
  );
}
