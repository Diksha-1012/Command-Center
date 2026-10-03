import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, MapPin, QrCode, ScanLine, Smartphone, UserPlus } from "lucide-react";
import { useNexus } from "@/store/DataContext";
import { joinSessionFor, pseudoQrMatrix } from "@/lib/join";
import { BadgeTone, Button, EmptyState, Panel, PanelHeader, SectionTitle } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

/**
 * QR JOIN EXPERIENCE (Part 3)
 * A simulated onboarding flow: the organizer generates an EVENT QR, a volunteer
 * "scans" it and lands on a mobile join screen with the event, roles, shift,
 * location and tasks. Demo-mode by design — no auth complexity.
 */

export function Join() {
  const { data } = useNexus();
  const navigate = useNavigate();
  const session = joinSessionFor(data);
  const [scanned, setScanned] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const matrix = pseudoQrMatrix(`nexus-join-${session.id}`, 21);

  return (
    <div className="space-y-5">
      <SectionTitle
        eyebrow="Onboarding"
        title="QR Join"
        description="A simulated QR onboarding flow. The organizer generates an EVENT QR; a volunteer scans it and instantly sees the event, available roles, shift, location and tasks."
        action={<BadgeTone tone="warn"><ScanLine size={11} /> SIMULATED QR</BadgeTone>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="EVENT QR"
            subtitle="Display this at the volunteer desk"
            icon={<QrCode size={14} />}
            action={
              <Button size="sm" variant="ai" onClick={() => setScanned((s) => !s)}>
                {scanned ? "Back to QR" : <><Smartphone size={13} /> Simulate scan</>}
              </Button>
            }
          />

          <div className="grid place-items-center gap-4 p-6">
            {!scanned ? (
              <>
                <div className="rounded-2xl border border-white/12 bg-white p-4 shadow-2xl">
                  <svg viewBox={`0 0 ${matrix.length} ${matrix.length}`} width={196} height={196} shapeRendering="crispEdges">
                    {matrix.map((row, y) =>
                      row.map((on, x) =>
                        on ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#05070f" /> : null,
                      ),
                    )}
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-100">{session.eventName}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {session.eventDate} · {session.venueName}
                  </div>
                  <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-slate-500">
                    This is a <strong className="text-slate-300">simulated</strong> QR for the demo — it is not a spec-compliant
                    QR payload and never claims to be. In production it would encode a signed join link.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={() => setScanned(true)}>
                    <ScanLine size={14} /> Simulate volunteer scan
                  </Button>
                  <Button variant="ghost" onClick={() => navigate("/me")}>
                    Open volunteer view <ArrowRight size={13} />
                  </Button>
                </div>
              </>
            ) : (
              <JoinFlow session={session} picked={picked} onPick={setPicked} onReset={() => { setScanned(false); setPicked(null); }} />
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="How it works" subtitle="Zero-friction onboarding" icon={<UserPlus size={14} />} />
          <div className="space-y-3 p-4 text-[11px] leading-relaxed text-slate-400">
            <p className="rounded-lg border border-white/8 bg-white/3 p-2.5">
              <span className="block text-slate-300">1 · Organizer generates</span>
              One QR per event, printed at the volunteer desk and shared in the briefing pack.
            </p>
            <p className="rounded-lg border border-white/8 bg-white/3 p-2.5">
              <span className="block text-slate-300">2 · Volunteer scans</span>
              No account, no password — the scanner opens the event join screen directly.
            </p>
            <p className="rounded-lg border border-white/8 bg-white/3 p-2.5">
              <span className="block text-slate-300">3 · Role + shift confirmed</span>
              The volunteer picks a role, sees their shift window and location, and gets their task checklist.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function JoinFlow({
  session, picked, onPick, onReset,
}: {
  session: ReturnType<typeof joinSessionFor>;
  picked: string | null;
  onPick: (id: string) => void;
  onReset: () => void;
}) {
  const selected = session.roles.find((r) => r.id === picked);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="w-full max-w-md space-y-4 text-left">
      <div className="rounded-2xl border border-sky-400/25 bg-sky-500/8 p-4">
        <BadgeTone tone="ok"><Check size={11} /> SCANNED</BadgeTone>
        <div className="mt-2 text-sm font-semibold text-slate-100">{session.eventName}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
          <MapPin size={11} /> {session.venueName} · {session.eventDate}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Available roles</div>
        <div className="space-y-2">
          {session.roles.map((r) => (
            <button
              key={r.id}
              onClick={() => onPick(r.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                picked === r.id ? "border-sky-400/40 bg-sky-500/10" : "border-white/8 bg-white/3 hover:bg-white/6",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-slate-100">{r.role}</span>
                <span className="mt-0.5 block text-[10px] text-slate-500">
                  {r.shift} · {r.location}
                </span>
              </span>
              <BadgeTone tone={r.spots > 3 ? "ok" : "warn"}>{r.spots} spots</BadgeTone>
              {picked === r.id ? <Check size={15} className="text-sky-300" /> : null}
            </button>
          ))}
          {session.roles.length === 0 ? <EmptyState title="No roles open" hint="All shifts are full." /> : null}
        </div>
      </div>

      {selected ? (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/8 p-3">
          <div className="text-sm font-medium text-emerald-200">Selected: {selected.role}</div>
          <div className="mt-1 text-[11px] text-slate-300">
            {selected.shift} at {selected.location}
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">On arrival</div>
        <ul className="space-y-1.5">
          {session.instructions.map((ins) => (
            <li key={ins} className="flex gap-2 text-[11px] text-slate-400">
              <span className="mt-0.5 text-slate-600">•</span>
              {ins}
            </li>
          ))}
        </ul>
      </div>

      {confirmed && selected ? (
        <div className="rounded-xl border border-sky-400/25 bg-sky-500/8 p-3">
          <BadgeTone tone="ok"><Check size={11} /> ROLE CONFIRMED</BadgeTone>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-300">
            {selected.role} · {selected.shift} at {selected.location}. Your shift and task checklist are now visible in the
            volunteer view.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!picked || confirmed} onClick={() => setConfirmed(true)}>
          <Check size={14} /> {confirmed ? "Confirmed" : "Confirm role"}
        </Button>
        <Button variant="ghost" onClick={onReset}>
          Scan again
        </Button>
      </div>
    </div>
  );
}