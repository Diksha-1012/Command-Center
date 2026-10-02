import type {
  DependencyGraph,
  EntityRef,
  GraphEdge,
  ImpactAnalysis,
  ImpactNode,
  NexusData,
  RiskFinding,
  RiskLevel,
} from "@/types";
import { buildDependencyGraph, KIND_IMPORTANCE, KIND_LABEL, nodeKey } from "./dependencyEngine";
import { analyzeRisk, riskLevelFor, RISK_RANK, type RiskReport } from "./riskEngine";

/**
 * NEXUS IMPACT ANALYZER (Part 2)
 * ======================================================================
 * Blast radius from a changed entity, computed by weighted breadth-first
 * traversal of the dependency graph.
 *
 *   depth 1      → DIRECT impact
 *   depth 2..3   → INDIRECT impact
 *   depth 4..6   → POTENTIAL impact (watch list)
 *
 * Confidence decays per hop (weight × 0.78^hop).
 * The impact score blends: volume, kind importance, peak risk, and whether
 * the origin is itself critical infrastructure.
 */

const MAX_DEPTH = 4;
const DECAY = 0.75;

export interface AnalyzeOptions {
  /** Pre-built graph (avoid rebuilding per call). */
  graph?: DependencyGraph;
  /** Pre-computed risk report. */
  risk?: RiskReport;
}

export function analyzeImpact(
  data: NexusData,
  source: EntityRef,
  change: string,
  opts: AnalyzeOptions = {},
): ImpactAnalysis {
  const graph = opts.graph ?? buildDependencyGraph(data);
  const risk = opts.risk ?? analyzeRisk(data);
  const rootKey = nodeKey(source.kind, source.id);

  const visited = new Map<string, ImpactNode>();
  visited.set(rootKey, {
    kind: source.kind,
    id: source.id,
    label: source.label,
    severity: "info",
    reason: "Change origin",
    depth: 0,
    via: "AFFECTS",
    confidence: 1,
  });

  let frontier: { key: string; confidence: number }[] = [{ key: rootKey, confidence: 1 }];

  /**
   * Propagation rules (this is what keeps the blast radius credible):
   *  1. Transitive: follow INCOMING edges — anyone who depends on the
   *     changed entity is affected, and their dependents are affected too.
   *  2. Non-transitive: include the changed/affected node's own direct
   *     requirements (outgoing edges) so a venue change surfaces the
   *     speakers and equipment its sessions consume.
   *  3. Requirements are NOT expanded further — this prevents the whole
   *     graph collapsing into every change.
   */
  const add = (key: string, edge: GraphEdge, depth: number, confidence: number) => {
    const node = graph.nodes[key];
    if (!node) return false;
    const nodeRisk = risk.byNode[key] ?? "none";
    visited.set(key, {
      kind: node.ref.kind,
      id: node.ref.id,
      label: node.name,
      severity: severityFromRisk(nodeRisk, depth),
      reason: edge.reason,
      depth,
      via: edge.kind,
      confidence: round2(confidence),
    });
    return true;
  };

  for (let depth = 1; depth <= MAX_DEPTH && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const cur of frontier) {
      // 1 + 2 — dependents (transitive) and direct requirements (terminal)
      for (const edge of graph.in[cur.key] ?? []) {
        const other = edge.from;
        if (visited.has(other)) continue;
        const confidence = Math.min(1, edge.weight * Math.pow(DECAY, depth - 1));
        if (add(other, edge, depth, confidence)) next.push({ key: other, confidence });
      }
      for (const edge of graph.out[cur.key] ?? []) {
        const other = edge.to;
        if (visited.has(other)) continue;
        add(other, edge, depth, edge.weight * Math.pow(DECAY, depth) * 0.9);
      }
    }
    frontier = next;
  }

  // Post-pass: any affected SESSION drags in the things it consumes
  // (speakers, equipment, venue, owning team). This mirrors the product's
  // public model: venue → sessions → speakers → equipment → volunteers.
  for (const node of [...visited.values()]) {
    if (node.depth === 0 || node.kind !== "session") continue;
    const skey = nodeKey("session", node.id);
    for (const edge of graph.out[skey] ?? []) {
      if (visited.has(edge.to)) continue;
      add(edge.to, edge, Math.min(MAX_DEPTH, node.depth + 1), edge.weight * 0.85);
    }
  }

  const all = [...visited.values()].filter((n) => n.depth > 0);
  const direct = all.filter((n) => n.depth === 1).sort(sortNodes);
  const indirect = all.filter((n) => n.depth >= 2 && n.depth <= 3).sort(sortNodes);
  const potential = all.filter((n) => n.depth >= 4).sort(sortNodes);

  const byKindMap = new Map<string, number>();
  for (const n of all) byKindMap.set(n.kind, (byKindMap.get(n.kind) ?? 0) + 1);
  const byKind = [...byKindMap.entries()]
    .map(([kind, count]) => ({ kind: kind as ImpactNode["kind"], label: KIND_LABEL[kind] ?? kind, count }))
    .sort((a, b) => b.count - a.count);

  const { score, reasons } = scoreImpact(source, all, risk, graph);
  const level: RiskLevel = score >= 82 ? "critical" : score >= 58 ? "high" : score >= 34 ? "medium" : score > 0 ? "low" : "none";

  const relatedKeys = new Set([rootKey, ...all.map((n) => nodeKey(n.kind, n.id))]);
  const riskFindings: RiskFinding[] = risk.findings
    .filter((f) => {
      if (f.ref && relatedKeys.has(nodeKey(f.ref.kind, f.ref.id))) return true;
      return f.related.some((r) => relatedKeys.has(nodeKey(r.kind, r.id)));
    })
    .sort((a, b) => RISK_RANK[b.level] - RISK_RANK[a.level])
    .slice(0, 8);

  return {
    source,
    change,
    direct,
    indirect,
    potential,
    byKind,
    totalAffected: all.length,
    impactScore: score,
    impactLevel: level,
    scoreReasons: reasons,
    riskFindings,
    sourceRecords: [source, ...all.slice(0, 12).map((n) => ({ kind: n.kind, id: n.id, label: n.label }))],
    generatedAt: new Date().toISOString(),
    engine: "graph",
  };
}

/* ------------------------------- scoring ------------------------------- */

function scoreImpact(
  source: EntityRef,
  affected: ImpactNode[],
  risk: RiskReport,
  graph: DependencyGraph,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // Volume — weighted by how operationally important each affected kind is.
  const volume = affected.reduce(
    (sum, n) => sum + (KIND_IMPORTANCE[n.kind] ?? 0.5) * (1 - (n.depth - 1) * 0.14),
    0,
  );
  // Logarithmic so 5 items and 50 items do not both saturate the score.
  const volumeScore = Math.min(42, Math.log2(1 + volume) * 7.5);

  // Breadth across distinct entity kinds.
  const distinctKinds = new Set(affected.map((n) => n.kind)).size;
  const breadthScore = Math.min(12, distinctKinds * 2.5);

  // Peak risk among everything touched (including the origin).
  const sourceRisk = riskLevelFor(risk, source);
  const peakRisk = affected.reduce<RiskLevel>((acc, n) => {
    const r = risk.byNode[nodeKey(n.kind, n.id)] ?? "none";
    return RISK_RANK[r] > RISK_RANK[acc] ? r : acc;
  }, sourceRisk);
  const riskScore = peakRisk === "critical" ? 22 : peakRisk === "high" ? 14 : peakRisk === "medium" ? 7 : 0;

  // Infrastructure weight — venues/sessions propagate much further.
  const infraScore = source.kind === "venue" ? 9 : source.kind === "session" ? 7 : source.kind === "resource" ? 5 : source.kind === "volunteer" ? 3 : 2;

  const raw = volumeScore + breadthScore + riskScore + infraScore;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  reasons.push(
    `${affected.length} downstream item${affected.length === 1 ? "" : "s"} reachable across ${distinctKinds} entity type${distinctKinds === 1 ? "" : "s"}.`,
  );
  const kindBreakdown = aggregate(affected);
  if (kindBreakdown.length) {
    reasons.push(kindBreakdown.map((k) => `${k.count} ${k.label.toLowerCase()}`).join(" · ") + ".");
  }
  if (RISK_RANK[peakRisk] >= RISK_RANK.high) {
    reasons.push(`Peak risk carried into the blast radius is ${peakRisk.toUpperCase()} (derived from the deterministic risk engine).`);
  }
  if (source.kind === "venue") {
    const sessionCount = affected.filter((n) => n.kind === "session").length;
    reasons.push(`Venue changes propagate through ${sessionCount} dependent session${sessionCount === 1 ? "" : "s"} before reaching speakers, equipment and volunteers.`);
  }
  const hopDepth = affected.reduce((m, n) => Math.max(m, n.depth), 0);
  reasons.push(`Longest dependency chain is ${hopDepth} hop${hopDepth === 1 ? "" : "s"} from the origin.`);
  void graph;

  return { score, reasons };
}

function aggregate(affected: ImpactNode[]) {
  const map = new Map<string, number>();
  for (const n of affected) map.set(n.kind, (map.get(n.kind) ?? 0) + 1);
  return [...map.entries()]
    .map(([kind, count]) => ({ kind, count, label: KIND_LABEL[kind] ?? kind }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------- helpers ------------------------------- */

function sortNodes(a: ImpactNode, b: ImpactNode) {
  return RISK_RANK[b.severity === "critical" ? "critical" : b.severity === "warning" ? "high" : "low"] -
    RISK_RANK[a.severity === "critical" ? "critical" : a.severity === "warning" ? "high" : "low"] ||
    b.confidence - a.confidence;
}

function severityFromRisk(risk: RiskLevel, depth: number) {
  if (depth <= 1) return risk === "critical" ? "critical" : risk === "high" ? "warning" : "info";
  if (depth <= 3) return risk === "critical" ? "warning" : "info";
  return "info";
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Resolve an entity reference's display label from the dataset. */
export function labelForRef(data: NexusData, kind: string, id: string): string {
  switch (kind) {
    case "venue": return data.venues.find((v) => v.id === id)?.name ?? id;
    case "session": return data.sessions.find((s) => s.id === id)?.title ?? id;
    case "speaker": return data.speakers.find((s) => s.id === id)?.name ?? id;
    case "team": return data.teams.find((t) => t.id === id)?.name ?? id;
    case "member": return data.members.find((m) => m.id === id)?.name ?? id;
    case "volunteer": return data.volunteers.find((v) => v.id === id)?.name ?? id;
    case "task": return data.tasks.find((t) => t.id === id)?.title ?? id;
    case "resource": return data.resources.find((r) => r.id === id)?.name ?? id;
    case "communication": return data.communications.find((c) => c.id === id)?.subject ?? id;
    case "incident": return data.incidents.find((i) => i.id === id)?.title ?? id;
    default: return id;
  }
}
