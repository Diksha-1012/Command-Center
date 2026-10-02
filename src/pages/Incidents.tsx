import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, GitBranch, MapPin, Plus, Siren, User } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { analyzeImpact } from "@/lib/impactAnalyzer";
import { BadgeTone, Button, Panel, PanelHeader, SectionTitle, StatusDot, Tabs } from "@/components/ui/primitives";
import { relativeFromNow, timeOf } from "@/lib/format";
import { NOW, CURRENT_USER_ID } from "@/data/seed";
import { cn } from "@/lib/cn";
import type { IncidentStatus, Severity } from "@/types";

const STATUS_TONE: Record<IncidentStatus, "bad" | "warn" | "blue" | "neutral" | "ok"> = {
  open: "bad",
  investigating: "warn",
  mitigated: "blue",
  resolved: "ok",
};

const SEV_TONE: Record<Severity, "bad" | "warn" | "blue"> = { critical: "bad", warning: "warn", info: "blue" };
const FLOW: IncidentStatus[] = ["open", "investigating", "mitigated", "resolved"];

export function Incidents() {
  const { data, createIncident, setIncidentStatus, graph, risk } = useNexus();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | IncidentStatus>("all");
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    severity: "warning" as Severity,
    location: "Main Auditorium",
    ownerId: "m1",
    relatedSessionId: "s-hack",
    notes: "",
  });

  const visible = useMemo(
    () => data.incidents.filter((i) => (filter === "all" ? true : i.status === filter)),
    [data.incidents, filter],
  );

  const counts = useMemo(
    () => ({
      all: data.incidents.length,
      open: data.incidents.filter((i) => i.status === "open").length,
      investigating: data.incidents.filter((i) => i.status === "investigating").length,
      mitigated: data.incidents.filter((i) => i.status === "mitigated").length,
      resolved: data.incidents.filter((i) => i.status === "resolved").length,
    }),
    [data.incidents],
  );

  const submit = () => {
    if (!form.title.trim()) return;
    createIncident({
      title: form.title.trim(),
      severity: form.severity,
      location: form.location,
      reportedBy: CURRENT_USER_ID,
      ownerId: form.ownerId,
      status: "open",
      relatedSessionId: form.relatedSessionId || undefined,
      notes: form.notes || "Reported from the NEXUS incident center.",
    });
    setForm({ ...form, title: "", notes: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Operations"
        title="Incident Center"
        description="Track what broke, who owns it and which sessions or resources it drags down."
        action={
          <Button size="sm" variant="primary" onClick={() => setShowForm((s) => !s)}>
            <Plus size={14} /> Create incident
          </Button>
        }
      />

      {showForm ? (
        <Panel className="border-violet-400/25">
          <PanelHeader title="New incident" subtitle="Applies immediately to the live demo store" icon={<Siren size={14} />} />
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <Field label="Title">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Stage-left projector failure"
                className="w-full rounded-lg border border-white/10 bg-ink-850 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
              />
            </Field>
            <Field label="Severity">
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })} className="w-full rounded-lg border border-white/10 bg-ink-850 px-3 py-2 text-sm text-slate-200">
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </Field>
            <Field label="Location">
              <select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded-lg border border-white/10 bg-ink-850 px-3 py-2 text-sm text-slate-200">
                {data.venues.map((v) => (
                  <option key={v.id} value={v.name}>{v.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Owner">
              <select value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} className="w-full rounded-lg border border-white/10 bg-ink-850 px-3 py-2 text-sm text-slate-200">
                {data.members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} · {m.role}</option>
                ))}
              </select>
            </Field>
            <Field label="Related session">
              <select value={form.relatedSessionId} onChange={(e) => setForm({ ...form, relatedSessionId: e.target.value })} className="w-full rounded-lg border border-white/10 bg-ink-850 px-3 py-2 text-sm text-slate-200">
                <option value="">None</option>
                {data.sessions.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Observed impact / immediate mitigation"
                className="w-full rounded-lg border border-white/10 bg-ink-850 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
              />
            </Field>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button variant="primary" onClick={submit} disabled={!form.title.trim()}>
                <Plus size={14} /> Open incident
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Open" value={counts.open} tone="bad" />
        <MiniStat label="Investigating" value={counts.investigating} tone="warn" />
        <MiniStat label="Mitigated" value={counts.mitigated} tone="blue" />
        <MiniStat label="Resolved" value={counts.resolved} tone="ok" />
      </div>

      <Tabs
        tabs={[
          { id: "all", label: "All" },
          { id: "open", label: "Open" },
          { id: "investigating", label: "Investigating" },
          { id: "mitigated", label: "Mitigated" },
          { id: "resolved", label: "Resolved" },
        ]}
        active={filter}
        onChange={setFilter}
        counts={counts}
      />

      <div className="space-y-3">
        {visible.map((inc) => {
          const reporter = data.members.find((m) => m.id === inc.reportedBy) ?? data.volunteers.find((v) => v.id === inc.reportedBy);
          const owner = data.members.find((m) => m.id === inc.ownerId);
          const session = data.sessions.find((s) => s.id === inc.relatedSessionId);
          const isOpen = expanded === inc.id;
          const impact = session
            ? analyzeImpact(data, { kind: "session", id: session.id, label: session.title }, "incident blast radius", { graph, risk })
            : null;

          return (
            <Panel key={inc.id} className={cn("p-4", inc.status !== "resolved" && inc.severity === "critical" && "border-l-2 border-l-rose-400")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl border", inc.severity === "critical" ? "border-rose-400/30 bg-rose-500/12 text-rose-300" : "border-amber-400/30 bg-amber-500/12 text-amber-300")}>
                    <Siren size={16} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-100">{inc.title}</span>
                      <BadgeTone tone={SEV_TONE[inc.severity]}>{inc.severity.toUpperCase()}</BadgeTone>
                      <BadgeTone tone={STATUS_TONE[inc.status]}>{inc.status}</BadgeTone>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><MapPin size={11} /> {inc.location}</span>
                      <span className="inline-flex items-center gap-1"><User size={11} /> reported by {reporter?.name ?? inc.reportedBy}</span>
                      <span>owner {owner?.name ?? inc.ownerId}</span>
                      <span>{relativeFromNow(inc.timestamp, NOW)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/4 p-0.5">
                  {FLOW.map((s) => (
                    <button
                      key={s}
                      onClick={() => setIncidentStatus(inc.id, s)}
                      className={cn("rounded-md px-2 py-1 text-[10px] uppercase tracking-wide", inc.status === s ? "bg-white/12 text-white" : "text-slate-400 hover:text-slate-200")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">{inc.notes}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {session ? (
                  <button onClick={() => navigate("/schedule")} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10">
                    session: {session.title} · {timeOf(session.startsAt)}
                  </button>
                ) : null}
                {inc.relatedResourceId ? (
                  <button onClick={() => navigate("/resources")} className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/10">
                    resource: {data.resources.find((r) => r.id === inc.relatedResourceId)?.name}
                  </button>
                ) : null}
                {impact ? (
                  <button
                    onClick={() => setExpanded(isOpen ? null : inc.id)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200 hover:bg-violet-500/20"
                  >
                    <GitBranch size={10} /> dependency blast radius ({impact.totalAffected})
                  </button>
                ) : null}
              </div>

              {isOpen && impact ? (
                <div className="mt-3 rounded-xl border border-white/8 bg-white/3 p-3">
                  <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                    <GitBranch size={11} /> connected dependencies
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {impact.direct.slice(0, 6).map((n) => (
                      <div key={`${n.kind}-${n.id}`} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-2.5 py-1.5">
                        <BadgeTone tone={n.severity === "critical" ? "bad" : n.severity === "warning" ? "warn" : "blue"}>{n.via.toLowerCase()}</BadgeTone>
                        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{n.label}</span>
                        <ArrowRight size={11} className="text-slate-600" />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {impact.byKind.map((k) => `${k.count} ${k.label.toLowerCase()}`).join(" · ")}
                  </p>
                </div>
              ) : null}
            </Panel>
          );
        })}
        {visible.length === 0 ? <Panel className="p-8 text-center text-sm text-slate-500">No incidents in this view.</Panel> : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: "bad" | "warn" | "blue" | "ok" }) {
  const colors = { bad: "text-rose-300", warn: "text-amber-300", blue: "text-sky-300", ok: "text-emerald-300" };
  return (
    <Panel className="p-3.5">
      <div className="flex items-center gap-1.5">
        <StatusDot tone={tone} />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <div className={cn("mt-1 font-mono text-2xl", colors[tone])}>{value}</div>
    </Panel>
  );
}
