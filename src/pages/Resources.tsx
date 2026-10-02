import { useMemo, useState } from "react";
import { AlertTriangle, Boxes, MapPin, Package, Search } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { resourceConflicts, resourceUtilization } from "@/lib/selectors";
import { BadgeTone, Panel, PanelHeader, ProgressBar, SectionTitle, StatusDot, Tabs } from "@/components/ui/primitives";
import { Donut, MiniBars } from "@/components/ui/charts";
import { cn } from "@/lib/cn";

const STATUS_TONE = {
  available: "ok",
  assigned: "blue",
  in_transit: "warn",
  maintenance: "bad",
} as const;

export function Resources() {
  const { data } = useNexus();
  const [filter, setFilter] = useState<"all" | "conflict" | "available">("all");
  const [q, setQ] = useState("");

  const conflicts = resourceConflicts(data.resources);
  const utilization = resourceUtilization(data.resources);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of data.resources) map.set(r.category, (map.get(r.category) ?? 0) + r.quantity);
    return [...map.entries()].map(([label, value]) => ({ label, value }));
  }, [data.resources]);

  const visible = data.resources
    .filter((r) => (filter === "conflict" ? r.assigned > r.available : filter === "available" ? r.available > 0 : true))
    .filter((r) => (q.trim() ? `${r.name} ${r.category} ${r.location}`.toLowerCase().includes(q.trim().toLowerCase()) : true));

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Inventory"
        title="Resources"
        description="Equipment allocation across every venue, with conflicts surfaced the moment demand exceeds supply."
        action={conflicts.length ? <BadgeTone tone="bad"><AlertTriangle size={11} /> {conflicts.length} conflicts</BadgeTone> : <BadgeTone tone="ok">all balanced</BadgeTone>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="Overall Utilization" subtitle={`${utilization.toFixed(0)}% of units allocated`} icon={<Boxes size={14} />} />
          <div className="flex items-center gap-5 p-4">
            <Donut
              segments={[
                { value: data.resources.reduce((n, r) => n + r.assigned, 0), color: "#60a5fa", label: "Assigned" },
                { value: data.resources.reduce((n, r) => n + r.available, 0), color: "#34d399", label: "Available" },
                { value: data.resources.reduce((n, r) => n + Math.max(0, r.quantity - r.assigned - r.available), 0), color: "#334155", label: "Reserved" },
              ]}
            />
            <div className="space-y-2 text-xs">
              <Legend color="#60a5fa" label="Assigned" value={data.resources.reduce((n, r) => n + r.assigned, 0)} />
              <Legend color="#34d399" label="Available" value={data.resources.reduce((n, r) => n + r.available, 0)} />
              <Legend color="#f87171" label="Over-allocated" value={conflicts.reduce((n, r) => n + (r.assigned - r.available), 0)} />
            </div>
          </div>
        </Panel>

        <Panel className="lg:col-span-2">
          <PanelHeader title="Units by Category" subtitle="Total quantity owned per category" icon={<Package size={14} />} />
          <div className="p-4">
            <MiniBars data={categories.map((c) => ({ label: c.label, value: c.value, color: "#818cf8" }))} />
          </div>
        </Panel>
      </div>

      {conflicts.length > 0 ? (
        <Panel className="border-l-2 border-l-rose-400">
          <PanelHeader title="Allocation Conflicts" subtitle="Assigned quantity exceeds available quantity" icon={<AlertTriangle size={14} />} action={<BadgeTone tone="bad">{conflicts.length}</BadgeTone>} />
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {conflicts.map((r) => (
              <div key={r.id} className="rounded-xl border border-rose-400/20 bg-rose-500/6 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-100">{r.name}</span>
                  <span className="font-mono text-xs text-rose-300">
                    {r.assigned} assigned / {r.available} free
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Short by <span className="font-semibold text-rose-300">{r.assigned - r.available}</span> units at {r.location}.
                </p>
                <div className="mt-2"><ProgressBar value={(r.assigned / r.quantity) * 100} tone="bad" height={5} /></div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: "all", label: "All resources" },
            { id: "conflict", label: "Conflicts" },
            { id: "available", label: "Available" },
          ]}
          active={filter}
          onChange={setFilter}
          counts={{ all: data.resources.length, conflict: conflicts.length, available: data.resources.filter((r) => r.available > 0).length }}
        />
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2">
          <Search size={14} className="text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search equipment, category, location…"
            className="w-56 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
      </div>

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-semibold">Resource</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Quantity</th>
                <th className="px-4 py-3 font-semibold">Available</th>
                <th className="px-4 py-3 font-semibold">Assigned</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const over = r.assigned > r.available;
                return (
                  <tr key={r.id} className={cn("border-b border-white/5", over && "bg-rose-500/4")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusDot tone={over ? "bad" : STATUS_TONE[r.status]} />
                        <span className="text-slate-200">{r.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.category}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.quantity}</td>
                    <td className={cn("px-4 py-3 font-mono text-xs", over ? "text-rose-300" : "text-emerald-300")}>{r.available}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{r.assigned}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1.5"><MapPin size={12} className="text-slate-600" />{r.location}</span>
                    </td>
                    <td className="px-4 py-3">
                      {over ? <BadgeTone tone="bad">over-allocated</BadgeTone> : <BadgeTone tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</BadgeTone>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span className="text-slate-400">{label}</span>
      <span className="ml-auto font-mono text-slate-300">{value}</span>
    </div>
  );
}
