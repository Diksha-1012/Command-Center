import type { CopilotSource, EntityRef, NexusData } from "@/types";
import { NOW } from "@/data/seed";
import {
  activeAlerts,
  computeKpis,
  overloadedVolunteers,
  operationalPulse,
  resourceConflicts,
  sortTasks,
} from "./selectors";
import { buildDependencyGraph } from "./dependencyEngine";
import { analyzeImpact } from "./impactAnalyzer";
import { analyzeRisk } from "./riskEngine";
import { teamLoadMap } from "./workloadAnalyzer";
import { recommendForSession, recommendReplacement } from "./recommendationEngine";
import { timeOf } from "./format";

/**
 * NEXUS COPILOT (Part 2)
 * ======================================================================
 * Deterministic, data-grounded answers over the dependency graph.
 *
 * Every answer returns:
 *   content    — the answer text
 *   source     — VERIFIED (computed from event data) or GENERATED (projection)
 *   confidence — 0..100
 *   why        — WHY the answer holds (explainability)
 *   sources    — clickable source records
 *
 * If nothing in the dataset supports the question, the copilot says so and
 * returns no fabricated operational facts.
 */

export interface CopilotAnswer {
  content: string;
  source: CopilotSource;
  confidence: number;
  why: string;
  citations?: string[];
  sources: EntityRef[];
}

export const SUGGESTED_QUESTIONS = [
  "What needs attention today?",
  "What is at risk?",
  "Which tasks are overdue?",
  "Who is overloaded?",
  "What happens if the auditorium changes?",
  "Which volunteers can replace Vivaan Rao?",
  "Which resources are currently conflicting?",
  "What sessions depend on the Main Auditorium?",
  "Show me all critical dependencies.",
];

export function answerQuestion(question: string, data: NexusData): CopilotAnswer {
  const q = question.toLowerCase().trim();
  const graph = buildDependencyGraph(data);
  const risk = analyzeRisk(data);

  /* ------------------------- attention today ------------------------- */
  if (has(q, ["attention", "today", "focus", "urgent", "what should i"])) {
    const alerts = activeAlerts(data).filter((a) => !a.acknowledged && a.severity !== "info");
    const blocked = data.tasks.filter((t) => t.status === "blocked");
    const criticalRisks = risk.findings.filter((f) => f.level === "critical");
    const sources: EntityRef[] = [
      ...alerts.slice(0, 3).map((a) => a.related),
      ...blocked.slice(0, 3).map((t) => ({ kind: "task" as const, id: t.id, label: t.title })),
    ];
    return verified(
      `**${alerts.length} active alerts**, **${blocked.length} blocked tasks** and **${criticalRisks.length} critical risk findings** need attention.\n\n` +
        alerts.slice(0, 3).map((a, i) => `${i + 1}. **${a.title}** — ${a.description}`).join("\n") +
        (blocked.length ? `\n\nBlocked: ${blocked.map((t) => `"${t.title}"`).join(", ")}.` : ""),
      sources,
      94,
      "Computed directly from unacknowledged alerts, blocked task statuses and the deterministic risk engine output.",
    );
  }

  /* ------------------------------ overdue ---------------------------- */
  if (has(q, ["overdue", "past deadline", "missed deadline", "late task"])) {
    const overdue = data.tasks.filter((t) => t.status !== "completed" && new Date(t.deadline).getTime() < new Date(NOW).getTime());
    return verified(
      overdue.length === 0
        ? "No tasks are past their deadline."
        : `**${overdue.length} tasks are overdue:**\n\n` +
          sortTasks(overdue).map((t) => `- **${t.title}** · ${t.department} · ${t.status.replace("_", " ")} · due ${timeOf(t.deadline)}`).join("\n"),
      overdue.map((t) => ({ kind: "task" as const, id: t.id, label: t.title })),
      overdue.length ? 97 : 90,
      "Filtered task records whose deadline precedes the operations clock and whose status is not completed.",
    );
  }

  /* ---------------------------- risk -------------------------------- */
  if (has(q, ["at risk", "risk", "risky", "danger", "critical dependencies", "what is at risk"])) {
    if (has(q, ["critical dependenc", "all critical dependenc"])) {
      const critical = risk.findings.filter((f) => f.level === "critical" || f.rule === "R-PROPAGATE");
      return verified(
        critical.length === 0
          ? "No critical dependency chains are currently failing."
          : `**${critical.length} critical dependency signals:**\n\n` +
            critical.slice(0, 8).map((f) => `- **${f.title}** — ${f.reason}`).join("\n"),
        critical.flatMap((f) => f.related).slice(0, 10),
        92,
        "Risk findings produced by deterministic rules (R-RESOURCE, R-BLOCKED, R-PROPAGATE, R-VENUE, R-INCIDENT).",
      );
    }
    const top = risk.findings.filter((f) => f.level === "critical" || f.level === "high").slice(0, 6);
    return verified(
      top.length === 0
        ? "No critical or high risk findings are active."
        : `**${top.length} items carry critical or high risk:**\n\n` +
          top.map((f) => `- **${f.title}** (${f.level.toUpperCase()}) — ${f.reason}`).join("\n"),
      top.flatMap((f) => f.related).slice(0, 10),
      93,
      "Derived from the risk engine's rule output across tasks, resources, volunteers, sessions and venues.",
    );
  }

  /* --------------------------- overloaded ---------------------------- */
  if (has(q, ["overload", "overworked", "burnout", "too much", "capacity"])) {
    const overloaded = overloadedVolunteers(data.volunteers);
    return verified(
      overloaded.length === 0
        ? "No volunteers are above the 80% workload threshold."
        : `**${overloaded.length} volunteers are overloaded (>80%):**\n\n` +
          overloaded.map((v) => `- **${v.name}** (${v.role}) — ${v.workload}% · ${v.currentAssignment}`).join("\n"),
      overloaded.map((v) => ({ kind: "volunteer" as const, id: v.id, label: v.name })),
      95,
      "Volunteer workload field compared against the 80% caution / 90% escalation thresholds.",
    );
  }

  /* --------------------------- replacement --------------------------- */
  const replaceTarget = findVolunteerInText(q, data);
  if (has(q, ["replace", "substitute", "cover for", "backup for"]) && replaceTarget) {
    const rec = recommendReplacement(data, replaceTarget.id);
    if (!rec?.best) {
      return noData(`No other volunteer in the roster has a record set that can be scored against ${replaceTarget.name}.`);
    }
    return verified(
      `**Best match to replace ${replaceTarget.name}: ${rec.best.name}** (score ${rec.best.total}/100)\n\n` +
        rec.best.reasons.map((r) => `- ${r}`).join("\n") +
        `\n\n**Alternatives**\n` +
        rec.alternatives.map((a) => `- ${a.name} — score ${a.total}/100 (skill ${a.skillMatch}%, workload ${a.workload}%)`).join("\n") +
        `\n\nThis is a recommendation only. Review, then assign manually.`,
      [
        { kind: "volunteer", id: replaceTarget.id, label: replaceTarget.name },
        { kind: "volunteer", id: rec.best.volunteerId, label: rec.best.name },
      ],
      88,
      "Recommendation engine scored every other volunteer on skill match, availability, spare capacity, shift overlap and travel distance.",
    );
  }

  /* --------------------------- conflicts ----------------------------- */
  if (has(q, ["conflict", "conflicting", "shortage", "short by"])) {
    const conflicts = resourceConflicts(data.resources);
    return verified(
      conflicts.length === 0
        ? "No resource is allocated beyond its available quantity."
        : `**${conflicts.length} resources are over-allocated:**\n\n` +
          conflicts.map((r) => `- **${r.name}** — ${r.assigned} assigned vs ${r.available} available (short by ${r.assigned - r.available}) at ${r.location}`).join("\n"),
      conflicts.map((r) => ({ kind: "resource" as const, id: r.id, label: r.name })),
      96,
      "Resource records where assigned quantity exceeds available quantity.",
    );
  }

  /* ---------------------- sessions depend on X ----------------------- */
  if (has(q, ["depend on", "depends on", "which sessions", "what sessions"])) {
    const venue = findVenueInText(q, data);
    if (!venue) return noData("I could not identify a venue in your question. Try naming a venue, e.g. \"Main Auditorium\".");
    const dependents = data.sessions.filter((s) => s.venueId === venue.id);
    return verified(
      `**${dependents.length} sessions depend on ${venue.name}:**\n\n` +
        dependents.map((s) => `- **${s.title}** · ${timeOf(s.startsAt)} · ${s.status.replace("_", " ")} · ${s.expectedAttendance.toLocaleString()} expected`).join("\n"),
      [
        { kind: "venue", id: venue.id, label: venue.name },
        ...dependents.map((s) => ({ kind: "session" as const, id: s.id, label: s.title })),
      ],
      97,
      "Structural LOCATED_AT edges from the dependency graph filtered to this venue.",
    );
  }

  /* --------------------------- venue change -------------------------- */
  if (has(q, ["auditorium", "venue change", "if the main", "moves", "change venue", "what happens if"])) {
    const venue = findVenueInText(q, data) ?? data.venues.find((v) => v.id === "v-main")!;
    const source: EntityRef = { kind: "venue", id: venue.id, label: venue.name };
    const analysis = analyzeImpact(data, source, `${venue.name} → alternative venue`, { graph, risk });
    return generated(
      `If **${venue.name}** changed, the dependency graph reaches **${analysis.totalAffected} downstream items** (impact score ${analysis.impactScore}/100 · ${analysis.impactLevel.toUpperCase()}).\n\n` +
        analysis.byKind.map((k) => `- ${k.count} ${k.label.toLowerCase()}`).join("\n") +
        `\n\nThis is a projection computed from the graph, not a confirmed outcome. Open the Impact Simulator to see the full chain and apply or discard the change.`,
      analysis.sourceRecords.slice(0, 8),
      74,
      `Weighted breadth-first traversal from ${venue.name}; ${analysis.direct.length} direct and ${analysis.indirect.length} indirect hops.`,
    );
  }

  /* --------------------------- team load ----------------------------- */
  if (has(q, ["team load", "department", "workload", "which team", "busiest"])) {
    const loads = teamLoadMap(data);
    const top = loads[0];
    return verified(
      `**Busiest department: ${top.name} at ${top.load}% load.**\n\n` +
        loads.map((l) => `- **${l.name}** — ${l.load}% ${l.overloaded ? "(overloaded)" : ""} · ${l.drivers.join("; ")}`).join("\n"),
      loads.slice(0, 5).map((l) => ({ kind: "team" as const, id: l.teamId, label: l.name })),
      92,
      "Team load = 60% mean volunteer workload + 40% live task pressure (open, overdue and blocked tasks).",
    );
  }

  /* --------------------------- incidents ----------------------------- */
  if (has(q, ["incident", "incidents", "what broke", "reported"])) {
    const open = data.incidents.filter((i) => i.status !== "resolved");
    return verified(
      open.length === 0
        ? "No open incidents."
        : `**${open.length} open incidents:**\n\n` +
          open.map((i) => `- **${i.title}** (${i.severity.toUpperCase()}) · ${i.location} · ${i.status}`).join("\n"),
      open.map((i) => ({ kind: "incident" as const, id: i.id, label: i.title })),
      95,
      "Incident records where status is not resolved.",
    );
  }

  /* --------------------------- volunteers gap ------------------------ */
  if (has(q, ["volunteer", "coverage", "staff", "roster", "gap"])) {
    const gaps = data.sessions
      .filter((s) => s.status !== "completed")
      .filter((s) => !data.tasks.some((t) => t.sessionId === s.id && t.ownerKind === "volunteer"));
    const rec = gaps[0] ? recommendForSession(data, gaps[0].id) : null;
    return verified(
      `**${data.volunteers.filter((v) => v.status === "assigned").length} of ${data.volunteers.length} volunteers** are assigned.\n\n` +
        (gaps.length ? `⚠️ ${gaps.length} session(s) have no volunteer-owned task. ` : "") +
        (rec?.best ? `\nFor **${gaps[0].title}** the strongest candidate is **${rec.best.name}** (score ${rec.best.total}/100): ${rec.best.reasons[0]}.` : ""),
      rec?.best ? [{ kind: "volunteer", id: rec.best.volunteerId, label: rec.best.name }] : [],
      87,
      "Roster status plus a coverage check for sessions with no volunteer-owned task.",
    );
  }

  /* ----------------------------- health ------------------------------ */
  if (has(q, ["health", "status", "overview", "how are we", "how is the event"])) {
    const kpis = computeKpis(data);
    const pulse = operationalPulse(data);
    return verified(
      `Event is **LIVE**. ${kpis.tasksCompleted}/${kpis.tasksTotal} tasks complete, **${kpis.atRiskItems} at-risk items**, ` +
        `${kpis.activeVolunteers} active volunteers, ${Math.round(kpis.resourceUtilization)}% resource utilization, ` +
        `**${risk.counts.critical} critical risk findings**.\n\n` +
        pulse.map((p) => `- ${p.label}: ${p.health.toUpperCase()} — ${p.metric ?? p.detail}`).join("\n"),
      pulse.map((p) => p.entity),
      94,
      "KPI selectors plus the operational pulse model computed from live session, task and resource state.",
    );
  }

  /* ------------------------------ notion ----------------------------- */
  if (has(q, ["notion", "sync", "knowledge"])) {
    return verified(
      `The Notion knowledge layer is in **${data.notion.mode.toUpperCase()} mode** and is **${data.notion.connected ? "connected" : "not connected"}**. ` +
        `${data.notionDatabases.length} databases are mapped (${data.notionDatabases.reduce((n, db) => n + db.rowCount, 0)} rows).`,
      [{ kind: "knowledge", id: "notion", label: data.notion.workspaceName }],
      90,
      "Read directly from the Notion connection state in the dataset.",
    );
  }

  /* ---------------------------- fallback ----------------------------- */
  return noData(
    "I could not map that question onto the event dataset. I only answer from verified records — tasks, sessions, volunteers, resources, dependencies, incidents and risks.",
  );
}

/* ------------------------------- helpers ------------------------------- */

function verified(content: string, sources: EntityRef[], confidence: number, why: string): CopilotAnswer {
  return { content, source: "verified", confidence, why, sources, citations: sources.slice(0, 5).map((s) => `${s.kind}: ${s.label}`) };
}

function generated(content: string, sources: EntityRef[], confidence: number, why: string): CopilotAnswer {
  return { content, source: "generated", confidence, why, sources, citations: sources.slice(0, 5).map((s) => `${s.kind}: ${s.label}`) };
}

function noData(reason: string): CopilotAnswer {
  return {
    content: `I don't have enough verified event data to answer this. ${reason}`,
    source: "verified",
    confidence: 100,
    why: "No matching records were found in the dataset for this question.",
    sources: [],
  };
}

function has(q: string, keys: string[]): boolean {
  return keys.some((k) => q.includes(k));
}

function findVenueInText(q: string, data: NexusData) {
  return data.venues.find((v) => q.includes(v.name.toLowerCase()) || q.includes(v.building.toLowerCase()) || (v.id === "v-main" && q.includes("main auditorium")));
}

function findVolunteerInText(q: string, data: NexusData) {
  return data.volunteers.find((v) => q.includes(v.name.toLowerCase()) || q.includes(v.name.split(" ")[0].toLowerCase()));
}

