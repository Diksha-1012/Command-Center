import { useState, type ReactNode } from "react";
import { Database, Pencil, Plus, Radio, Trash2, TriangleAlert } from "lucide-react";
import { useNexus, type CollectionKey } from "@/store/DataContext";
import { ENTITY_FORMS, type EntityFormConfig, type FieldDef, splitList } from "@/lib/forms";
import { BadgeTone, Button, EmptyState, Panel, PanelHeader, SectionTitle, Tabs } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/Overlay";
import { ModeBadge, RecordSourceLabel } from "@/components/domain/RecordSource";
import { cn } from "@/lib/cn";
import type { Dependency, EntityKind, NexusData } from "@/types";

/**
 * DATA STUDIO (Data Mode architecture)
 * ======================================================================
 * Clean interfaces for entering REAL operational data. Every form writes
 * through the store's `createEntity` / `updateEntity`, so records land in the
 * application's actual data layer with provenance attached automatically.
 *
 * In DEMO mode new records are tagged `sourceType: "demo"` and live only in the
 * demo workspace. In LIVE mode they are tagged `sourceType: "live"` and are
 * persisted to the device so real user-created records survive reloads.
 */

const FIELD_CLASS =
  "w-full rounded-lg border border-white/10 bg-ink-850 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none";

const LABEL_OF: Record<string, (r: Record<string, unknown>) => string> = {
  venues: (r) => String(r.name ?? r.id),
  speakers: (r) => String(r.name ?? r.id),
  sessions: (r) => String(r.title ?? r.id),
  teams: (r) => String(r.name ?? r.id),
  members: (r) => String(r.name ?? r.id),
  volunteers: (r) => String(r.name ?? r.id),
  participants: (r) => String(r.name ?? r.id),
  tasks: (r) => String(r.title ?? r.id),
  resources: (r) => String(r.name ?? r.id),
  dependencies: (r) => String(r.id),
  communications: (r) => String(r.subject ?? r.id),
  knowledge: (r) => String(r.title ?? r.id),
  incidents: (r) => String(r.title ?? r.id),
};

export function DataStudio() {
  const { data, mode, counts, createEntity, deleteEntity, updateEvent } = useNexus();
  const [active, setActive] = useState<CollectionKey>("sessions");
  const [creating, setCreating] = useState(false);
  const [editingEvent, setEditingEvent] = useState(false);

  const config = ENTITY_FORMS.find((f) => f.key === active)!;
  const records = (data[active] as unknown as Record<string, unknown>[]) ?? [];

  const live = mode === "live";

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Data"
        title="Data Studio"
        description="Enter and manage real operational records. Everything here writes to the application's data layer — not just frontend state."
        action={<ModeBadge mode={mode} detail={live ? "records persist on this device" : "demo workspace"} />}
      />

      {!live ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-500/8 px-3 py-2.5">
          <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-300" />
          <p className="text-[11px] leading-relaxed text-slate-300">
            You are in <strong className="text-amber-200">DEMO MODE</strong>. Records you create here are tagged{" "}
            <code className="text-amber-200">sourceType: "demo"</code> and live only in the synthetic workspace. Switch to{" "}
            <strong className="text-emerald-200">LIVE MODE</strong> to create real operational records.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/8 px-3 py-2.5">
          <Radio size={15} className="mt-0.5 shrink-0 text-emerald-300" />
          <p className="text-[11px] leading-relaxed text-slate-300">
            You are in <strong className="text-emerald-200">LIVE MODE</strong>. Records are tagged{" "}
            <code className="text-emerald-200">sourceType: "live"</code> and are stored on this device. Demo records are
            hidden and never mixed in.
          </p>
        </div>
      )}

      {/* Event header */}
      <Panel>
        <PanelHeader
          title="Event"
          subtitle="The workspace's root record"
          icon={<Database size={14} />}
          action={
            <Button size="sm" variant="outline" onClick={() => setEditingEvent(true)}>
              <Pencil size={13} /> Edit event
            </Button>
          }
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Name" value={data.event.name} source={data.event.sourceType} />
          <Stat label="Date" value={data.event.date} source={data.event.sourceType} />
          <Stat label="Phase" value={data.event.phase} source={data.event.sourceType} />
          <Stat label="Organizers" value={data.event.organizers.join(" · ") || "—"} source={data.event.sourceType} />
        </div>
      </Panel>

      <Tabs
        tabs={ENTITY_FORMS.map((f) => ({ id: f.key, label: `${f.icon} ${f.label}` }))}
        active={active}
        onChange={(k) => setActive(k as CollectionKey)}
        counts={Object.fromEntries(ENTITY_FORMS.map((f) => [f.key, (data[f.key] as unknown[]).length]))}
      />

      <Panel>
        <PanelHeader
          title={config.label}
          subtitle={config.blurb}
          icon={<span className="text-sm">{config.icon}</span>}
          action={
            <Button size="sm" variant={live ? "primary" : "ai"} onClick={() => setCreating(true)}>
              <Plus size={13} /> New {config.singular}
            </Button>
          }
        />

        <div className="p-4">
          {records.length === 0 ? (
            <EmptyState title={`No ${config.label.toLowerCase()} yet`} hint={`Create the first ${config.singular}.`} />
          ) : (
            <div className="space-y-2">
              {records.map((r) => (
                <div key={String(r.id)} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm text-slate-200">{LABEL_OF[active]?.(r) ?? String(r.id)}</span>
                      <RecordSourceLabel source={r.sourceType as never} />
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-500">
                      {summarize(active, r, data)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    title="Delete this record"
                    onClick={() => {
                      if (confirm(`Delete ${LABEL_OF[active]?.(r) ?? r.id}? This cannot be undone.`)) deleteEntity(active, String(r.id));
                    }}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <NewRecordDrawer
        open={creating}
        config={config}
        data={data}
        onClose={() => setCreating(false)}
        onCreate={(record) => {
          createEntity(active, record as never);
          setCreating(false);
        }}
      />

      <EditEventDrawer
        open={editingEvent}
        data={data}
        onClose={() => setEditingEvent(false)}
        onSave={(patch) => {
          updateEvent(patch);
          setEditingEvent(false);
        }}
      />

      <p className="text-center text-[11px] text-slate-500">
        {counts.demo} demo records · {counts.live} live records · stored separately, never mixed.
      </p>
    </div>
  );
}

function summarize(collection: CollectionKey, r: Record<string, unknown>, data: NexusData): string {
  switch (collection) {
    case "sessions":
      return `${r.track ?? "—"} · ${data.venues.find((v) => v.id === r.venueId)?.name ?? "no venue"} · ${String(r.status ?? "")}`;
    case "tasks":
      return `${r.department ?? "—"} · ${String(r.priority ?? "")} · ${String(r.status ?? "")}`;
    case "volunteers":
      return `${r.role ?? "—"} · workload ${r.workload ?? 0}% · ${String(r.status ?? "")}`;
    case "participants":
      return `${r.ticketType ?? "—"} · ${r.email ?? ""} · ${String(r.status ?? "")}`;
    case "resources":
      return `${r.category ?? "—"} · ${r.available ?? 0} free / ${r.quantity ?? 0} · ${String(r.status ?? "")}`;
    case "teams":
      return `${data.members.filter((m) => m.teamId === r.id).length} members · ${String(r.status ?? "")}`;
    case "dependencies":
      return `${(r.source as { label?: string })?.label ?? "—"} → ${(r.target as { label?: string })?.label ?? "—"} · ${String(r.type ?? "")}`;
    case "incidents":
      return `${String(r.severity ?? "")} · ${String(r.location ?? "")} · ${String(r.status ?? "")}`;
    case "communications":
      return `${String(r.channel ?? "")} · ${String(r.audience ?? "")} · ${String(r.status ?? "")}`;
    case "speakers":
      return `${r.title ?? "—"} · ${r.org ?? "—"} · arrival ${String(r.arrivalStatus ?? "")}`;
    default:
      return String(r.summary ?? r.description ?? "");
  }
}

function Stat({ label, value, source }: { label: string; value: string; source?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/3 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <RecordSourceLabel source={source as never} compact />
      </div>
      <div className="mt-1 truncate text-sm text-slate-200">{value}</div>
    </div>
  );
}

/* --------------------------- new record form -------------------------- */

function NewRecordDrawer({
  open,
  config,
  data,
  onClose,
  onCreate,
}: {
  open: boolean;
  config: EntityFormConfig;
  data: NexusData;
  onClose: () => void;
  onCreate: (record: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => defaultValues(config));

  const set = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));

  const submit = () => {
    const record = buildRecord(config, values, data);
    onCreate(record);
    setValues(defaultValues(config));
  };

  const missingRequired = config.fields.filter((f) => f.required && !values[f.key]?.trim());

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`New ${config.singular}`}
      subtitle={<span className="text-slate-500">Writes to the {data.event.name} workspace data layer</span>}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={missingRequired.length > 0}>
            <Plus size={13} /> Create {config.singular}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {config.fields.map((field) => (
          <FieldRow key={field.key} field={field} value={values[field.key] ?? ""} onChange={(v) => set(field.key, v)} data={data} />
        ))}
        <div className="rounded-xl border border-white/8 bg-white/3 p-3">
          <div className="flex items-center gap-2">
            <BadgeTone tone="ok">VERIFIED SOURCE</BadgeTone>
            <span className="text-[11px] text-slate-400">
              The new {config.singular} is written to the operational store with provenance attached automatically.
            </span>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function defaultValues(config: EntityFormConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of config.fields) out[f.key] = f.defaultValue != null ? String(f.defaultValue) : "";
  return out;
}

function buildRecord(config: EntityFormConfig, values: Record<string, string>, data: NexusData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of config.fields) {
    const raw = values[f.key] ?? "";
    if (raw === "") continue;
    switch (f.kind) {
      case "number":
        out[f.key] = Number(raw);
        break;
      case "datetime":
        out[f.key] = raw.length === 16 ? `${raw}:00` : raw;
        break;
      case "select":
        if (f.key === "confirmed") out[f.key] = raw === "true";
        else out[f.key] = raw;
        break;
      default:
        out[f.key] = raw;
    }
  }
  // List coercion for well-known comma-separated fields.
  if (config.key === "venues" && typeof out.features === "string") out.features = splitList(out.features);
  if (config.key === "volunteers" && typeof out.skills === "string") out.skills = splitList(out.skills);

  // Fill in required structural fields the domain model expects.
  if (config.key === "sessions") {
    out.eventId = data.event.id;
    out.speakerIds = [];
    out.resourceIds = [];
    out.notes = out.notes ?? "Created from Data Studio.";
  }
  if (config.key === "members" || config.key === "volunteers" || config.key === "speakers") {
    out.avatarTone = "neutral";
  }
  if (config.key === "tasks") {
    const ownerId = String(out.ownerId ?? data.members[0]?.id ?? data.volunteers[0]?.id ?? "");
    out.ownerId = ownerId;
    out.ownerKind = data.members.some((m) => m.id === ownerId) ? "member" : "volunteer";
    out.progress = out.status === "completed" ? 100 : 0;
    out.dependencyIds = [];
    out.description = out.description ?? "Created from Data Studio.";
  }
  if (config.key === "incidents") {
    out.reportedBy = data.members[0]?.id ?? "unknown";
    out.ownerId = out.ownerId ?? data.members[0]?.id ?? "unknown";
    out.notes = out.notes ?? "Reported from Data Studio.";
  }
  if (config.key === "communications") {
    out.scheduledAt = out.scheduledAt ?? new Date().toISOString();
  }
  if (config.key === "knowledge") {
    out.updatedAt = new Date().toISOString();
    out.notionPageId = "";
  }
  if (config.key === "dependencies") {
    const dep: Omit<Dependency, "id" | "sourceType"> = {
      source: { kind: (values.sourceKind || "venue") as EntityKind, id: values.sourceId || "unknown", label: values.sourceLabel || "Source" },
      target: { kind: (values.targetKind || "session") as EntityKind, id: values.targetId || "unknown", label: values.targetLabel || "Target" },
      type: (values.type || "scheduling") as Dependency["type"],
      severity: (values.severity || "warning") as Dependency["severity"],
      description: values.description || "Declared from Data Studio.",
    };
    return dep as unknown as Record<string, unknown>;
  }
  return out;
}

function FieldRow({
  field,
  value,
  onChange,
  data,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  data: NexusData;
}) {
  const label = (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {field.label}
      {field.required ? <span className="ml-1 text-rose-300">*</span> : null}
    </span>
  );

  let control: ReactNode;
  if (field.kind === "textarea") {
    control = <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={cn(FIELD_CLASS, "resize-none")} />;
  } else if (field.kind === "select") {
    control = (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_CLASS}>
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === "ref") {
    const refRecords = (data[field.refCollection as CollectionKey] as unknown as Record<string, unknown>[]) ?? [];
    control = (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_CLASS}>
        <option value="">— none —</option>
        {refRecords.map((r) => (
          <option key={String(r.id)} value={String(r.id)}>
            {LABEL_OF[field.refCollection as string]?.(r) ?? String(r.id)}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === "datetime") {
    control = <input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_CLASS} />;
  } else if (field.kind === "date") {
    control = <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className={FIELD_CLASS} />;
  } else if (field.kind === "number") {
    control = <input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={FIELD_CLASS} />;
  } else {
    control = <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={FIELD_CLASS} />;
  }

  return (
    <label className="block space-y-1.5">
      {label}
      {control}
    </label>
  );
}

/* ---------------------------- edit event ------------------------------ */

function EditEventDrawer({
  open,
  data,
  onClose,
  onSave,
}: {
  open: boolean;
  data: NexusData;
  onClose: () => void;
  onSave: (patch: { name: string; tagline: string; date: string; participantTarget: number; volunteerPool: number }) => void;
}) {
  const [name, setName] = useState(data.event.name);
  const [tagline, setTagline] = useState(data.event.tagline);
  const [date, setDate] = useState(data.event.date);
  const [participants, setParticipants] = useState(String(data.event.participantTarget));
  const [pool, setPool] = useState(String(data.event.volunteerPool));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit event"
      subtitle={<span className="text-slate-500">Updates the root record of this workspace</span>}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              onSave({
                name: name.trim() || data.event.name,
                tagline,
                date,
                participantTarget: Number(participants) || 0,
                volunteerPool: Number(pool) || 0,
              })
            }
          >
            Save event
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tagline</span>
          <textarea rows={2} value={tagline} onChange={(e) => setTagline(e.target.value)} className={cn(FIELD_CLASS, "resize-none")} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD_CLASS} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Participant target</span>
            <input type="number" value={participants} onChange={(e) => setParticipants(e.target.value)} className={FIELD_CLASS} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Volunteer pool</span>
            <input type="number" value={pool} onChange={(e) => setPool(e.target.value)} className={FIELD_CLASS} />
          </label>
        </div>
      </div>
    </Drawer>
  );
}
