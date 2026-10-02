import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Crown, ListChecks, Mail, UserSquare2, Users2 } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { teamRollups } from "@/lib/selectors";
import { Avatar, BadgeTone, Button, Panel, PanelHeader, ProgressBar, SectionTitle, StatusDot, Tabs } from "@/components/ui/primitives";
import { MiniBars } from "@/components/ui/charts";
import { cn } from "@/lib/cn";

export function Teams() {
  const { data } = useNexus();
  const navigate = useNavigate();
  const [active, setActive] = useState<string>("all");
  const rollups = teamRollups(data);

  const visible = active === "all" ? rollups : rollups.filter((r) => r.teamId === active);

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Organisation"
        title="Teams"
        description="Seven departments own the run-of-show. Each has a lead, a volunteer cell and a task queue."
        action={<Button size="sm" variant="outline" onClick={() => navigate("/volunteers")}>Volunteer roster <ArrowUpRight size={13} /></Button>}
      />

      <Tabs
        tabs={[{ id: "all", label: "All teams" }, ...rollups.map((r) => ({ id: r.teamId, label: r.name }))]}
        active={active}
        onChange={setActive}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {visible.map((team) => {
            const members = data.members.filter((m) => m.teamId === team.teamId);
            const volunteers = data.volunteers.filter((v) => v.teamId === team.teamId);
            const tasks = data.tasks.filter((t) => t.teamId === team.teamId);
            const total = team.openTasks + team.doneTasks || 1;
            return (
              <Panel key={team.teamId} className={cn("p-4", team.status !== "healthy" && "border-l-2", team.status === "warning" && "border-l-amber-400", team.status === "critical" && "border-l-rose-400")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300">
                      <Users2 size={17} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-100">{team.name}</h3>
                        <StatusDot tone={team.status === "healthy" ? "ok" : team.status === "warning" ? "warn" : "bad"} />
                        <BadgeTone tone={team.status === "healthy" ? "ok" : team.status === "warning" ? "warn" : "bad"}>{team.status}</BadgeTone>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{data.teams.find((t) => t.id === team.teamId)?.description}</p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Crown size={11} className="text-amber-300" /> {team.leadName}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => navigate("/tasks")}>
                    <ListChecks size={13} /> {team.openTasks} open
                  </Button>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
                    <div className="font-mono text-lg text-slate-100">{members.length}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Core members</div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
                    <div className="font-mono text-lg text-slate-100">{volunteers.length}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Volunteers</div>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/3 p-2.5">
                    <div className="font-mono text-lg text-slate-100">{Math.round((team.doneTasks / total) * 100)}%</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-500">Task progress</div>
                  </div>
                </div>

                <div className="mt-3">
                  <ProgressBar value={(team.doneTasks / total) * 100} tone={team.status === "critical" ? "bad" : team.status === "warning" ? "warn" : "ok"} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {members.map((m) => (
                    <span key={m.id} className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/3 py-1 pl-1 pr-2.5">
                      <Avatar name={m.name} tone={m.avatarTone} size={22} />
                      <span className="text-[11px] text-slate-300">{m.name}</span>
                      <span className="text-[10px] text-slate-500">{m.role}</span>
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><Mail size={11} /> {members[0]?.email}</span>
                  <span className="inline-flex items-center gap-1"><UserSquare2 size={11} /> {volunteers.map((v) => v.name.split(" ")[0]).join(", ") || "no volunteers"}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tasks.slice(0, 4).map((t) => (
                    <span key={t.id} className={cn("rounded-md border px-1.5 py-0.5 text-[10px]", t.status === "blocked" ? "border-rose-400/25 bg-rose-500/10 text-rose-300" : "border-white/10 bg-white/5 text-slate-400")}>
                      {t.title.length > 34 ? `${t.title.slice(0, 34)}…` : t.title}
                    </span>
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Workload by Team" subtitle="Open tasks per department" icon={<Users2 size={14} />} />
            <div className="p-4">
              <MiniBars
                data={rollups.map((r) => ({ label: r.name, value: r.openTasks, color: r.status === "critical" ? "#f87171" : r.status === "warning" ? "#fbbf24" : "#34d399" }))}
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Escalation Path" subtitle="Who to call, in order" icon={<Crown size={14} />} />
            <div className="space-y-2 p-4">
              {["Operations Lead — Aisha Khan", "Technical Lead — Nikhil Menon", "Volunteer Coordinator — Sneha Pillai", "Security Lead — Capt. R. Singh"].map((line, i) => (
                <div key={line} className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/3 p-2.5">
                  <span className="grid h-5 w-5 place-items-center rounded-md bg-violet-500/15 text-[10px] font-bold text-violet-300">{i + 1}</span>
                  <span className="text-xs text-slate-300">{line}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
