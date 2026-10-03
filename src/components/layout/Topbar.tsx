import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Search, Bell, CircleDot } from "lucide-react";
import { NAV_ITEMS } from "./nav";
import { useNexus } from "@/store/DataContext";
import { EVENT_DATE_LABEL, NOW, CURRENT_USER_ID } from "@/data/seed";
import { activeAlerts } from "@/lib/selectors";
import { Avatar } from "@/components/ui/primitives";
import { ModeIndicator, ModeSwitcher } from "@/components/domain/RecordSource";
import { timeOf } from "@/lib/format";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { data, mode, setMode, counts } = useNexus();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const me = data.members.find((m) => m.id === CURRENT_USER_ID);
  const unack = activeAlerts(data).filter((a) => !a.acknowledged && a.severity !== "info").length;

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return NAV_ITEMS.filter((i) => i.label.toLowerCase().includes(term)).slice(0, 6);
  }, [q]);

  const jump = (to: string) => {
    navigate(to);
    setQ("");
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/8 bg-ink-950/70 px-4 backdrop-blur-xl">
      <button onClick={onMenu} className="focus-ring rounded-lg p-2 text-slate-400 hover:bg-white/8 lg:hidden">
        <Menu size={18} />
      </button>

      <div className="hidden items-center gap-3 md:flex">
        <div className="hidden xl:block">
          <ModeIndicator mode={mode} />
        </div>
        <ModeSwitcher mode={mode} onChange={setMode} counts={counts} />
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-1.5">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">Event</span>
          <span className="max-w-[180px] truncate text-sm font-semibold text-slate-100">{data.event.name}</span>
        </div>
        <div className="hidden items-center gap-1.5 text-xs text-slate-500 2xl:flex">
          <CircleDot size={12} className="text-slate-600" />
          {mode === "demo" ? `${EVENT_DATE_LABEL} · ${timeOf(NOW)} ops clock` : "live workspace"}
        </div>
      </div>

      <div className="ml-auto flex md:hidden">
        <ModeSwitcher mode={mode} onChange={setMode} counts={counts} />
      </div>

      <div className="relative ml-auto w-full max-w-xs md:ml-0">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2">
          <Search size={15} className="text-slate-500" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) jump(results[0].to);
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Quick jump to a module…"
            className="w-full bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
        </div>
        {open && results.length > 0 ? (
          <div className="absolute mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-ink-850/95 shadow-2xl backdrop-blur-xl">
            {results.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.to}
                  onMouseDown={() => jump(r.to)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/8"
                >
                  <Icon size={15} className="text-slate-500" />
                  {r.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <button
        onClick={() => navigate("/command")}
        title={`${unack} unacknowledged alerts`}
        className="focus-ring relative rounded-xl border border-white/10 bg-white/4 p-2 text-slate-300 hover:bg-white/8"
      >
        <Bell size={16} />
        {unack > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unack}
          </span>
        ) : null}
      </button>

      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 py-1.5 pl-1.5 pr-3">
        <Avatar name={me?.name ?? "User"} tone="ai" size={28} />
        <div className="hidden leading-tight sm:block">
          <div className="text-xs font-semibold text-slate-200">{me?.name}</div>
          <div className="text-[10px] text-slate-500">{me?.role}</div>
        </div>
      </div>
    </header>
  );
}
