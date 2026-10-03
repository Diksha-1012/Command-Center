import type {
  ChangeRequest,
  DependencyGraph,
  EntityKind,
  EntityRef,
  NexusData,
  RecommendedAction,
  RiskFinding,
  SimulationResult,
} from "@/types";
import { simulateChange } from "./changeSimulator";
import type { RiskReport } from "./riskEngine";

/**
 * NEXUS EMERGENCY SIMULATION (Part 3) — the signature demo moment.
 * ======================================================================
 * "MAIN AUDITORIUM UNAVAILABLE" is modelled honestly: every session that lives
 * in the auditorium is re-homed to a fallback venue, each change is run through
 * the real change simulator, and the blast radii are unioned. Nothing here is
 * hardcoded — scores, counts and actions all come from the engines.
 */

export interface EmergencyChainStep {
  key: EntityKind;
  label: string;
  count: number;
  tone: "ok" | "warn" | "bad" | "ai" | "blue" | "neutral";
}

export interface EmergencyResult {
  venue: EntityRef;
  target: EntityRef;
  headline: string;
  requests: ChangeRequest[];
  results: SimulationResult[];
  impactScore: number;
  affected: number;
  critical: number;
  actions: RecommendedAction[];
  risks: RiskFinding[];
  chain: EmergencyChainStep[];
  affectedRefs: EntityRef[];
  aiExplanation: string;
}

const CHAIN_ORDER: { key: EntityKind; label: string; tone: EmergencyChainStep["tone"] }[] = [
  { key: "session", label: "Sessions", tone: "blue" },
  { key: "speaker", label: "Speakers", tone: "ai" },
  { key: "resource", label: "Resources", tone: "warn" },
  { key: "volunteer", label: "Volunteers", tone: "neutral" },
  { key: "task", label: "Tasks", tone: "ok" },
  { key: "communication", label: "Communications", tone: "ai" },
];

export function runEmergencySimulation(
  data: NexusData,
  graph: DependencyGraph,
  risk: RiskReport,
  toVenueId = "v-innov",
): EmergencyResult | null {
  const venue = data.venues.find((v) => v.id === "v-main");
  if (!venue) return null;
  const target = data.venues.find((v) => v.id === toVenueId) ?? data.venues.find((v) => v.id !== venue.id);
  if (!target) return null;

  const sessions = data.sessions.filter((s) => s.venueId === venue.id);
  const requests: ChangeRequest[] = sessions.map((s) => ({
    kind: "change_venue",
    subjectId: s.id,
    subjectKind: "session",
    subjectLabel: s.title,
    fromValue: venue.name,
    toValue: target.name,
    toId: target.id,
  }));
  if (!requests.length) return null;

  const results = requests.map((r) => simulateChange(data, r, { graph, risk }));

  // Union every affected node across the per-session blast radii.
  const refMap = new Map<string, EntityRef>();
  for (const r of results) {
    for (const n of [...r.analysis.direct, ...r.analysis.indirect, ...r.analysis.potential]) {
      refMap.set(`${n.kind}:${n.id}`, { kind: n.kind, id: n.id, label: n.label });
    }
  }
  const affectedRefs = [...refMap.values()];

  const maxScore = Math.max(...results.map((r) => r.analysis.impactScore));
  const breadthBonus = Math.min(12, (results.length - 1) * 4);
  const impactScore = Math.min(100, maxScore + breadthBonus);

  const riskMap = new Map<string, RiskFinding>();
  for (const r of results) for (const f of r.risks) riskMap.set(f.id, f);
  const risks = [...riskMap.values()];

  const critical =
    affectedRefs.filter((ref) => (risk.byNode[`${ref.kind}:${ref.id}`] ?? "none") === "critical").length +
    risks.filter((f) => f.level === "critical").length;

  const actionMap = new Map<string, RecommendedAction>();
  for (const r of results) for (const a of r.actions) if (!actionMap.has(a.title)) actionMap.set(a.title, a);
  const actions = [...actionMap.values()].slice(0, 5);

  const countOf = (kind: EntityKind) => affectedRefs.filter((r) => r.kind === kind).length;
  const chain: EmergencyChainStep[] = CHAIN_ORDER.map((c) => ({ ...c, count: countOf(c.key) }));

  const aiExplanation =
    `${venue.name} is unavailable. ${sessions.length} session${sessions.length === 1 ? "" : "s"} must relocate to ${target.name}. ` +
    `Traversing the dependency graph, the change reaches ${affectedRefs.length} operational item${affectedRefs.length === 1 ? "" : "s"} across ` +
    `${chain.filter((c) => c.count > 0).length} entity types. The deterministic risk engine surfaces ${risks.length} risk condition${risks.length === 1 ? "" : "s"}` +
    `${critical ? `, ${critical} of them critical` : ""}. The blended impact score is ${impactScore}/100. ` +
    `NEXUS has prepared ${actions.length} recommended action${actions.length === 1 ? "" : "s"} — nothing is applied until a human approves.`;

  return {
    venue: { kind: "venue", id: venue.id, label: venue.name },
    target: { kind: "venue", id: target.id, label: target.name },
    headline: `${venue.name} unavailable → relocate to ${target.name}`,
    requests,
    results,
    impactScore,
    affected: affectedRefs.length,
    critical,
    actions,
    risks,
    chain,
    affectedRefs,
    aiExplanation,
  };
}