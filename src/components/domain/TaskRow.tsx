import { AlertOctagon, CalendarClock, GitBranch, Link2 } from "lucide-react";
import type { AccentTone, NexusData, Task } from "@/types";
import { cn } from "@/lib/cn";
import { NOW } from "@/data/seed";
import { isOverdue, timeOf } from "@/lib/format";
import { Avatar, PriorityBadge, ProgressBar, StatusBadge } from "@/components/ui/primitives";

export function TaskRow({
  task,
  data,
  onClick,
  showDeps = true,
}: {
  task: Task;
  data: NexusData;
  onClick?: (task: Task) => void;
  showDeps?: boolean;
}) {
  const owner =
    task.ownerKind === "volunteer"
      ? data.volunteers.find((v) => v.id === task.ownerId)
      : data.members.find((m) => m.id === task.ownerId);
  const ownerTone: AccentTone = task.ownerKind === "volunteer" ? "blue" : "ai";
  const overdue = isOverdue(task.deadline, NOW) && task.status !== "completed";
  const deps = task.dependencyIds
    .map((id) => data.tasks.find((t) => t.id === id))
    .filter(Boolean) as Task[];
  const blockers = deps.filter((t) => t.status !== "completed");

  return (
    <button
      type="button"
      onClick={() => onClick?.(task)}
      className={cn(
        "group w-full rounded-xl border border-white/8 bg-white/3 p-3 text-left transition-all hover:border-white/14 hover:bg-white/6",
        task.status === "blocked" && "border-l-2 border-l-rose-400",
        task.status === "completed" && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={owner?.name ?? "Unassigned"} tone={ownerTone} size={30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium leading-snug text-slate-100">{task.title}</p>
            <PriorityBadge priority={task.priority} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
            <span className="text-slate-300">{owner?.name ?? "Unassigned"}</span>
            <span className="text-slate-600">·</span>
            <span>{task.department}</span>
            <span className="text-slate-600">·</span>
            <span className={cn("inline-flex items-center gap-1", overdue ? "text-rose-300" : "text-slate-400")}>
              <CalendarClock size={11} /> {timeOf(task.deadline)}
              {overdue ? " · overdue" : ""}
            </span>
            {task.sessionId ? (
              <>
                <span className="text-slate-600">·</span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Link2 size={11} /> {data.sessions.find((s) => s.id === task.sessionId)?.title}
                </span>
              </>
            ) : null}
          </div>

          <div className="mt-2.5 flex items-center gap-3">
            <div className="w-36">
              <ProgressBar
                value={task.progress}
                tone={task.status === "blocked" ? "bad" : task.status === "completed" ? "ok" : "blue"}
                height={5}
              />
            </div>
            <span className="font-mono text-[10px] text-slate-500">{task.progress}%</span>
            <div className="ml-auto flex items-center gap-2">
              {blockers.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-rose-400/25 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                  <AlertOctagon size={10} /> {blockers.length} blocker{blockers.length > 1 ? "s" : ""}
                </span>
              ) : null}
              {showDeps && deps.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                  <GitBranch size={10} /> {deps.length} dep{deps.length > 1 ? "s" : ""}
                </span>
              ) : null}
              <StatusBadge status={task.status} />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
