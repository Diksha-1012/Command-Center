import { NavLink } from "react-router-dom";
import { NAV_GROUPS, NAV_ITEMS } from "./nav";
import { cn } from "@/lib/cn";
import { useNexus } from "@/store/DataContext";
import { activeAlerts } from "@/lib/selectors";
import { canAccess, ROLE_BY_ID } from "@/lib/roles";
import { ModeBadge } from "@/components/domain/RecordSource";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { data, role, dataSource, mode } = useNexus();
  const roleDef = ROLE_BY_ID[role];
  const items = NAV_ITEMS.filter((i) => canAccess(roleDef, i.to));
  const groups = NAV_GROUPS.filter((g) => items.some((i) => i.group === g));
  const alertCount = activeAlerts(data).filter((a) => !a.acknowledged && a.severity !== "info").length;
  const openTasks = data.tasks.filter((t) => t.status !== "completed").length;
  const openIncidents = data.incidents.filter((i) => i.status !== "resolved").length;

  return (
    <div className="flex h-full w-[248px] shrink-0 flex-col border-r border-white/8 bg-ink-900/70 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-600/30">
          <span className="text-sm font-black tracking-tighter">NX</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-wide text-slate-50">NEXUS OPS</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Command Center</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group} className="mb-4">
            <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">{group}</div>
            <div className="space-y-0.5">
              {items.filter((i) => i.group === group).map((item) => {
                const Icon = item.icon;
                const badge =
                  item.badgeKey === "alerts" ? alertCount : item.badgeKey === "tasks" ? openTasks : item.badgeKey === "incidents" ? openIncidents : 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "focus-ring group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all",
                        isActive
                          ? "bg-gradient-to-r from-sky-500/18 to-violet-500/10 text-white border border-white/10"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={16} className={cn(isActive ? "text-sky-300" : "text-slate-500 group-hover:text-slate-300")} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {badge > 0 ? (
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                              item.badgeKey === "alerts" || item.badgeKey === "incidents" ? "bg-rose-500/20 text-rose-300" : "bg-white/8 text-slate-400",
                            )}
                          >
                            {badge}
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-1.5 border-t border-white/8 px-4 py-3">
        <ModeBadge mode={mode} className="w-full justify-center" />
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className={cn("h-1.5 w-1.5 rounded-full", dataSource.kind === "live" ? "bg-sky-400" : "bg-amber-400")} />
          {dataSource.label}
        </div>
        <div className="truncate text-[10px] text-slate-600">{roleDef.name} · {data.event.name}</div>
      </div>
    </div>
  );
}
