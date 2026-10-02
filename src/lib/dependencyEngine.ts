import type {
  DependencyGraph,
  EdgeKind,
  EntityRef,
  GraphEdge,
  GraphNode,
  NexusData,
  RiskLevel,
  Severity,
} from "@/types";

/**
 * NEXUS DEPENDENCY ENGINE (Part 2)
 * ======================================================================
 * Builds a real, typed dependency graph from the event dataset — never
 * from hardcoded visual lines. Every node is a domain entity with a
 * status, risk and owner; every edge carries a relationship kind and a
 * propagation weight used by the impact analyser.
 *
 * Edge direction convention: `from` DEPENDS ON `to` (the dependent points
 * at the thing it needs). Blast radius traverses both directions because a
 * change to `to` invalidates `from`, and a change to `from` also drags in
 * the things it consumes.
 */

export const nodeKey = (type: string, id: string) => `${type}:${id}`;

/** Propagation strength per relationship kind (0..1). */
export const EDGE_WEIGHT: Record<EdgeKind, number> = {
  REQUIRES: 0.95,
  USES: 0.9,
  DEPENDS_ON: 0.95,
  LOCATED_AT: 0.9,
  ASSIGNED_TO: 0.7,
  OWNED_BY: 0.6,
  COMMUNICATES_TO: 0.5,
  AFFECTS: 0.75,
};

/** How much each node type matters when scoring the blast radius (0..1). */
export const KIND_IMPORTANCE: Record<string, number> = {
  session: 1,
  speaker: 0.85,
  resource: 0.8,
  volunteer: 0.75,
  task: 0.7,
  communication: 0.6,
  incident: 0.8,
  team: 0.55,
  venue: 0.95,
  member: 0.5,
  event: 1,
  knowledge: 0.2,
  scheduleItem: 0.3,
};

export const KIND_LABEL: Record<string, string> = {
  session: "Sessions",
  speaker: "Speakers",
  resource: "Equipment",
  volunteer: "Volunteers",
  task: "Tasks",
  communication: "Communications",
  incident: "Incidents",
  team: "Teams",
  venue: "Venues",
  member: "Members",
  event: "Event",
  knowledge: "Knowledge",
  scheduleItem: "Schedule",
};

const severityWeight = (s: Severity): number => (s === "critical" ? 0.95 : s === "warning" ? 0.7 : 0.4);

class GraphBuilder {
  nodes: Record<string, GraphNode> = {};
  edges: GraphEdge[] = [];
  private out: Record<string, GraphEdge[]> = {};
  private inc: Record<string, GraphEdge[]> = {};
  private n = 0;

  node(ref: EntityRef, status: string, owner?: string, risk: RiskLevel = "none") {
    const key = nodeKey(ref.kind, ref.id);
    if (!this.nodes[key]) {
      this.nodes[key] = { key, id: ref.id, type: ref.kind, name: ref.label, status, risk, owner, ref };
    }
    return key;
  }

  /** Adds `from --kind--> to` (from depends on to). */
  edge(from: string, to: string, kind: EdgeKind, reason: string, weightOverride?: number) {
    if (!from || !to || from === to) return;
    const e: GraphEdge = {
      id: `e${++this.n}`,
      from,
      to,
      kind,
      weight: weightOverride ?? EDGE_WEIGHT[kind],
      reason,
    };
    this.edges.push(e);
    (this.out[from] ??= []).push(e);
    (this.inc[to] ??= []).push(e);
  }

  build(): DependencyGraph {
    return { nodes: this.nodes, edges: this.edges, out: this.out, in: this.inc };
  }
}

export function buildDependencyGraph(data: NexusData): DependencyGraph {
  const b = new GraphBuilder();
  const ref = (kind: EntityRef["kind"], id: string, label: string): EntityRef => ({ kind, id, label });

  // ---------------------------- venues --------------------------------
  for (const v of data.venues) {
    b.node(ref("venue", v.id, v.name), v.status, "Operations");
  }

  // ---------------------------- teams ---------------------------------
  for (const t of data.teams) {
    const lead = data.members.find((m) => m.id === t.leadMemberId);
    b.node(ref("team", t.id, t.name), t.status, lead?.name);
    if (lead) b.edge(nodeKey("team", t.id), nodeKey("member", lead.id), "OWNED_BY", `${t.name} is led by ${lead.name}.`);
  }

  // ---------------------------- members -------------------------------
  for (const m of data.members) {
    b.node(ref("member", m.id, m.name), "active", m.role);
    b.edge(nodeKey("member", m.id), nodeKey("team", m.teamId), "ASSIGNED_TO", `${m.name} belongs to this team.`);
  }

  // --------------------------- volunteers -----------------------------
  for (const v of data.volunteers) {
    b.node(ref("volunteer", v.id, v.name), v.status, v.role);
    b.edge(nodeKey("volunteer", v.id), nodeKey("team", v.teamId), "ASSIGNED_TO", `${v.name} is rostered to this team.`);
  }

  // ---------------------------- speakers ------------------------------
  for (const s of data.speakers) {
    b.node(ref("speaker", s.id, s.name), s.arrivalStatus, s.org);
  }

  // ---------------------------- resources -----------------------------
  for (const r of data.resources) {
    b.node(ref("resource", r.id, r.name), r.status, r.category);
    // LOCATED_AT when the location string matches a venue name or building.
    const venue = data.venues.find((v) => r.location.toLowerCase().includes(v.name.toLowerCase().split(" ")[0].toLowerCase()));
    if (venue) b.edge(nodeKey("resource", r.id), nodeKey("venue", venue.id), "LOCATED_AT", `${r.name} is stored at ${venue.name}.`);
  }

  // ---------------------------- sessions ------------------------------
  for (const s of data.sessions) {
    const site = ref("session", s.id, s.title);
    b.node(site, s.status, "Operations", s.riskLevel === "critical" ? "critical" : s.riskLevel === "warning" ? "high" : "none");
    const skey = nodeKey("session", s.id);

    const venue = data.venues.find((v) => v.id === s.venueId);
    if (venue) b.edge(skey, nodeKey("venue", venue.id), "LOCATED_AT", `${s.title} is scheduled in ${venue.name}.`);

    for (const spId of s.speakerIds) {
      const sp = data.speakers.find((x) => x.id === spId);
      if (sp) b.edge(skey, nodeKey("speaker", sp.id), "REQUIRES", `${s.title} requires ${sp.name} on stage.`);
    }
    for (const rId of s.resourceIds) {
      const r = data.resources.find((x) => x.id === rId);
      if (r) b.edge(skey, nodeKey("resource", r.id), "USES", `${s.title} uses ${r.name}.`);
    }
    const team = data.teams.find((t) => t.id === s.teamId);
    if (team) b.edge(skey, nodeKey("team", team.id), "ASSIGNED_TO", `${s.title} is operated by ${team.name}.`);
  }

  // ----------------------------- tasks --------------------------------
  for (const t of data.tasks) {
    const tref = ref("task", t.id, t.title);
    const tkey = nodeKey("task", t.id);
    b.node(tref, t.status, t.department, t.status === "blocked" ? "critical" : t.priority === "critical" ? "high" : "low");

    for (const depId of t.dependencyIds) {
      const dep = data.tasks.find((x) => x.id === depId);
      if (dep) b.edge(tkey, nodeKey("task", dep.id), "DEPENDS_ON", `"${t.title}" waits on "${dep.title}".`);
    }
    if (t.sessionId) {
      const s = data.sessions.find((x) => x.id === t.sessionId);
      if (s) b.edge(tkey, nodeKey("session", s.id), "REQUIRES", `"${t.title}" supports ${s.title}.`);
    }
    if (t.resourceId) {
      const r = data.resources.find((x) => x.id === t.resourceId);
      if (r) b.edge(tkey, nodeKey("resource", r.id), "USES", `"${t.title}" needs ${r.name}.`);
    }
    if (t.ownerKind === "volunteer") {
      const v = data.volunteers.find((x) => x.id === t.ownerId);
      if (v) b.edge(tkey, nodeKey("volunteer", v.id), "OWNED_BY", `${v.name} owns "${t.title}".`);
    } else {
      const m = data.members.find((x) => x.id === t.ownerId);
      if (m) b.edge(tkey, nodeKey("member", m.id), "OWNED_BY", `${m.name} owns "${t.title}".`);
    }
  }

  // -------------------------- communications --------------------------
  for (const c of data.communications) {
    b.node(ref("communication", c.id, c.subject), c.status, c.audience);
    if (c.relatedSessionId) {
      const s = data.sessions.find((x) => x.id === c.relatedSessionId);
      if (s) b.edge(nodeKey("communication", c.id), nodeKey("session", s.id), "COMMUNICATES_TO", `${c.subject} is targeted at ${s.title}.`);
    }
  }

  // ----------------------------- incidents ----------------------------
  for (const i of data.incidents) {
    b.node(ref("incident", i.id, i.title), i.status, i.ownerId, i.severity === "critical" ? "critical" : i.severity === "warning" ? "high" : "low");
    const ikey = nodeKey("incident", i.id);
    if (i.relatedSessionId) {
      const s = data.sessions.find((x) => x.id === i.relatedSessionId);
      if (s) b.edge(ikey, nodeKey("session", s.id), "AFFECTS", `${i.title} affects ${s.title}.`, severityWeight(i.severity));
    }
    if (i.relatedResourceId) {
      const r = data.resources.find((x) => x.id === i.relatedResourceId);
      if (r) b.edge(ikey, nodeKey("resource", r.id), "AFFECTS", `${i.title} affects ${r.name}.`, severityWeight(i.severity));
    }
  }

  // ------------------- declared dependency edges ----------------------
  for (const dep of data.dependencies) {
    const fromKey = nodeKey(dep.source.kind, dep.source.id);
    const toKey = nodeKey(dep.target.kind, dep.target.id);
    if (!b.nodes[fromKey]) b.node(dep.source, "unknown");
    if (!b.nodes[toKey]) b.node(dep.target, "unknown");
    b.edge(fromKey, toKey, "AFFECTS", dep.description, severityWeight(dep.severity));
  }

  return b.build();
}

/** Convenience: all edges touching a node (both directions). */
export function edgesOf(graph: DependencyGraph, key: string): GraphEdge[] {
  return [...(graph.out[key] ?? []), ...(graph.in[key] ?? [])];
}

export function neighborsOf(graph: DependencyGraph, key: string): string[] {
  const set = new Set<string>();
  for (const e of graph.out[key] ?? []) set.add(e.to);
  for (const e of graph.in[key] ?? []) set.add(e.from);
  return [...set];
}

export function findNodeByRef(graph: DependencyGraph, ref: EntityRef): GraphNode | undefined {
  return graph.nodes[nodeKey(ref.kind, ref.id)];
}
