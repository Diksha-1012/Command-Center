import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, GitBranch, Layers, Link2, Package, Play, Plus, UserCheck } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { NOW } from "@/data/seed";
import { blockedDependents, filterTasks, sortTasks, type TaskView } from "@/lib/selectors";
import { Avatar, BadgeTone, Button, ComingNext, Panel, PanelHeader, PriorityBadge, ProgressBar, SectionTitle, StatusBadge, Tabs } from "@/components/ui/primitives";
import { Drawer } from "@/components/ui/Overlay";
import { TaskRow } from "@/components/domain/TaskRow";
import { isOverdue, timeOf, STATUS_LABEL } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Task, TaskStatus } from "@/types";

const COLUMNS: { status: TaskStatus; label: string; tone: "ok" | "warn" | "bad" | "neutral" | "blue" }[] = [
  { status: "not_started", label: "Not Started", tone: "neutral" },
  { status: "in_progress", label: "In Progress", tone: "blue" },
  { status: "blocked", label: "Blocked", tone: "bad" },
  { status: "completed", label: "Completed", tone: "ok" },
];

export function Tasks() {
  const { data, setTaskStatus, setTaskProgress } = useNexus();
  const navigate = useNavigate();
  const [view, setView] = useState<TaskView>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: data.tasks.length,
      mine: filterTasks(data.tasks, "mine", "m1").length,
      critical: filterTasks(data.tasks, "critical", "m1").length,
      overdue: filterTasks(data.tasks, "overdue", "m1").length,
      today: filterTasks(data.tasks, "today", "m1").length,
      completed: filterTasks(data.tasks, "completed", "m1").length,
    }),
    [data.tasks],
  );

  const filtered = sortTasks(filterTasks(data.tasks, view, "m1"));
  const selected = data.tasks.find((t) => t.id === selectedId) ?? null;

  const overdue = data.tasks.filter((t) => isOverdue(t.deadline, NOW) && t.status !== "completed").length;
  const completion = (counts.completed / (counts.all || 1)) * 100;

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Execution"
        title="Task Board"
        description="Every operational task, its owner, its blockers and the session it protects."
        action={
          <div className="flex items-center gap-2">
            <ComingNext label="NEW TASK PERSISTENCE — PART 2" />
            <Button size="sm" variant="outline" disabled title="Task creation will persist once the backend lands in Part 2">
              <Plus size={14} /> New task
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Completion" value={`${Math.round(completion)}%`} tone="ok" hint={`${counts.completed}/${counts.all} done`} />
        <MiniStat label="In progress" value={String(counts.all - counts.completed - filterTasks(data.tasks, "all", "m1").filter((t) => t.status === "blocked").length)} tone="blue" hint="active workstreams" />
        <MiniStat label="Blocked" value={String(data.tasks.filter((t) => t.status === "blocked").length)} tone="bad" hint="waiting on dependencies" />
        <MiniStat label="Overdue" value={String(overdue)} tone="bad" hint="past deadline" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: "all", label: "All" },
            { id: "mine", label: "My Tasks" },
            { id: "critical", label: "Critical" },
            { id: "overdue", label: "Overdue" },
            { id: "today", label: "Today" },
            { id: "completed", label: "Completed" },
          ]}
          active={view}
          onChange={setView}
          counts={counts}
        />
        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
          <Layers size={12} /> {filtered.length} tasks · sorted by priority then deadline
        </span>
      </div>

      {view === "all" || view === "mine" ? (
        <div className="grid gap-4 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = sortTasks(filtered.filter((t) => t.status === col.status));
            return (
              <div key={col.status} className="flex flex-col rounded-2xl border border-white/8 bg-white/2 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", col.tone === "ok" ? "bg-emerald-400" : col.tone === "bad" ? "bg-rose-400" : col.tone === "blue" ? "bg-sky-400" : "bg-slate-400")} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{col.label}</span>
                  </div>
                  <span className="rounded bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((t) => (
                    <TaskRow key={t.id} task={t} data={data} onClick={(task) => setSelectedId(task.id)} showDeps={false} />
                  ))}
                  {items.length === 0 ? <p className="py-6 text-center text-[11px] text-slate-600">Nothing here</p> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Panel>
          <PanelHeader title={`${view.charAt(0).toUpperCase() + view.slice(1)} tasks`} subtitle={`${filtered.length} matching tasks`} icon={<Layers size={14} />} />
          <div className="space-y-2 p-4">
            {filtered.map((t) => (
              <TaskRow key={t.id} task={t} data={data} onClick={(task) => setSelectedId(task.id)} />
            ))}
            {filtered.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No tasks in this view.</p> : null}
          </div>
        </Panel>
      )}

      <TaskDrawer
        task={selected}
        data={data}
        onClose={() => setSelectedId(null)}
        onStatus={(id, status) => setTaskStatus(id, status)}
        onProgress={(id, p) => setTaskProgress(id, p)}
        onOpenSession={() => {
          setSelectedId(null);
          navigate("/schedule");
        }}
      />
    </div>
  );
}

function MiniStat({ label, value, tone, hint }: { label: string; value: string; tone: "ok" | "warn" | "bad" | "blue"; hint: string }) {
  const colors: Record<string, string> = { ok: "text-emerald-300", warn: "text-amber-300", bad: "text-rose-300", blue: "text-sky-300" };
  return (
    <Panel className="p-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl", colors[tone])}>{value}</div>
      <div className="text-[10px] text-slate-500">{hint}</div>
    </Panel>
  );
}

function TaskDrawer({
  task,
  data,
  onClose,
  onStatus,
  onProgress,
  onOpenSession,
}: {
  task: Task | null;
  data: ReturnType<typeof useNexus>["data"];
  onClose: () => void;
  onStatus: (id: string, status: TaskStatus) => void;
  onProgress: (id: string, progress: number) => void;
  onOpenSession: () => void;
}) {
  if (!task) return null;
  const owner = task.ownerKind === "volunteer" ? data.volunteers.find((v) => v.id === task.ownerId) : data.members.find((m) => m.id === task.ownerId);
  const deps = data.tasks.filter((t) => task.dependencyIds.includes(t.id));
  const dependents = blockedDependents(data.tasks, task);
  const session = data.sessions.find((s) => s.id === task.sessionId);
  const resource = data.resources.find((r) => r.id === task.resourceId);
  const overdue = isOverdue(task.deadline, NOW) && task.status !== "completed";

  return (
    <Drawer
      open={!!task}
      onClose={onClose}
      title={task.title}
      subtitle={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={task.status} /><PriorityBadge priority={task.priority} /><span className="text-slate-500">{task.department}</span></span>}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-3">
          <Avatar name={owner?.name ?? "Unassigned"} tone={task.ownerKind === "volunteer" ? "blue" : "ai"} size={38} />
          <div>
            <div className="text-sm text-slate-200">{owner?.name ?? "Unassigned"}</div>
            <div className="text-[11px] text-slate-500">{task.ownerKind === "volunteer" ? "Volunteer" : "Core member"}</div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <CalendarClock size={12} className={overdue ? "text-rose-400" : "text-slate-600"} />
            {timeOf(task.deadline)}{overdue ? " · overdue" : ""}
          </span>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Progress</div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={task.progress}
              onChange={(e) => onProgress(task.id, Number(e.target.value))}
              className="h-1.5 w-full accent-sky-400"
            />
            <span className="w-10 text-right font-mono text-xs text-slate-300">{task.progress}%</span>
          </div>
          <div className="mt-2"><ProgressBar value={task.progress} tone={task.status === "blocked" ? "bad" : "blue"} /></div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Update status</div>
          <div className="grid grid-cols-2 gap-2">
            {COLUMNS.map((c) => (
              <Button
                key={c.status}
                size="sm"
                variant={task.status === c.status ? "primary" : "outline"}
                onClick={() => onStatus(task.id, c.status)}
              >
                {c.status === "in_progress" ? <Play size={12} /> : <UserCheck size={12} />}
                {STATUS_LABEL[c.status]}
              </Button>
            ))}
          </div>
        </div>

        {deps.length > 0 || dependents.length > 0 ? (
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <GitBranch size={12} /> Dependencies
            </div>
            <div className="space-y-2">
              {deps.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 p-2.5">
                  <BadgeTone tone="blue">depends on</BadgeTone>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{d.title}</span>
                  <StatusBadge status={d.status} />
                </div>
              ))}
              {dependents.map((d) => (
                <div key={d.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 p-2.5">
                  <BadgeTone tone="warn">blocks</BadgeTone>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{d.title}</span>
                  <StatusBadge status={d.status} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {session || resource ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {session ? (
              <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Related session</div>
                <button onClick={onOpenSession} className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-200 hover:text-sky-300">
                  <Link2 size={13} /> {session.title}
                </button>
              </div>
            ) : null}
            {resource ? (
              <div className="rounded-xl border border-white/8 bg-white/3 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Related resource</div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-200">
                  <Package size={13} /> {resource.name}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="text-[11px] text-slate-500">
          Status and progress changes apply to the live demo store immediately. Persistence to Notion/backend lands in Part 2.
        </p>
      </div>
    </Drawer>
  );
}
