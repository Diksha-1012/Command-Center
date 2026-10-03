import { useLocation, useNavigate } from "react-router-dom";
import { useNexus } from "@/store/DataContext";
import { canAccess, homeFor, ROLES, ROLE_BY_ID } from "@/lib/roles";
import { cn } from "@/lib/cn";
import type { RoleId } from "@/types";

/** ROLE SWITCHING (Part 3) — the same data, three experiences. */
export function RoleSwitcher({ compact }: { compact?: boolean }) {
  const { role, setRole } = useNexus();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const change = (id: RoleId) => {
    const def = ROLE_BY_ID[id];
    setRole(id);
    if (!canAccess(def, pathname)) navigate(homeFor(def));
  };

  return (
    <div
      className="flex items-center gap-0.5 rounded-xl border border-white/10 bg-white/4 p-0.5"
      role="group"
      aria-label="Switch role"
    >
      {ROLES.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => change(r.id)}
          aria-pressed={role === r.id}
          title={r.blurb}
          className={cn(
            "focus-ring rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all",
            role === r.id ? "bg-gradient-to-r from-sky-500/25 to-violet-500/20 text-white" : "text-slate-400 hover:text-slate-200",
          )}
        >
          {compact ? r.name.split(" ")[0] : r.name}
        </button>
      ))}
    </div>
  );
}
