import type { EntityRef, NexusData, RiskFinding, RiskLevel } from "@/types";
import { NOW } from "@/data/seed";
import { isOverdue } from "./format";
import { nodeKey } from "./dependencyEngine";

/**
 * NEXUS RISK ENGINE (Part 2)
 * ======================================================================
 * Deterministic rules FIRST — no AI. Every finding carries a stable rule
 * id and a human explanation so the UI can answer "WHY is this at risk?"
 * instead of showing a red badge with no reasoning.
 *
 * Rules (as specified):
 *   R-OVERDUE      task past deadline                     → HIGH
 *   R-BLOCKED      task blocked by an upstream task        → HIGH
 *   R-RESOURCE     critical resource unavailable           → CRITICAL
 *   R-WORKLOAD     volunteer workload > 90%                → HIGH
 *   R-NO-AV        session has no AV/equipment resource    → HIGH
 *   R-NO-COVERAGE  session has no volunteer coverage       → HIGH
 *   R-PROPAGATE    dependency target is blocked            → inherits risk
 *   R-VENUE        venue-level resource conflict           → CRITICAL
 *   R-SPEAKER      speaker arrival unconfirmed/delayed     → MEDIUM
 *   R-INCIDENT     open critical incident on an entity     → CRITICAL
 */

export const RISK_RANK: Record<RiskLevel, number> = { critical: 4, high: 3, medium: 2, low: 1, none: 0 };

const AV_CATEGORIES = ["Projectors", "Microphones", "Cameras", "Network", "Comms", "Lighting"];

export interface RiskReport {
  findings: RiskFinding[];
  /** Risk level per node key (`type:id`). */
  byNode: Record<string, RiskLevel>;
  /** Score 0..100 per node key. */
  scoreByNode: Record<string, number>;
  /** Findings grouped by node key. */
  findingsByNode: Record<string, RiskFinding[]>;
  counts: Record<RiskLevel, number>;
}

function push(report: RiskReport, ref: EntityRef | undefined, nodeKeyStr: string, finding: RiskFinding) {
  report.findings.push(finding);
  if (nodeKeyStr) {
    report.findingsByNode[nodeKeyStr] = [...(report.findingsByNode[nodeKeyStr] ?? []), finding];
    const current = report.byNode[nodeKeyStr] ?? "none";
    if (RISK_RANK[finding.level] > RISK_RANK[current]) report.byNode[nodeKeyStr] = finding.level;
    const bump = finding.level === "critical" ? 55 : finding.level === "high" ? 35 : finding.level === "medium" ? 18 : 6;
    report.scoreByNode[nodeKeyStr] = Math.min(100, (report.scoreByNode[nodeKeyStr] ?? 0) + bump);
  }
  void ref;
}

export function analyzeRisk(data: NexusData): RiskReport {
  const report: RiskReport = { findings: [], byNode: {}, scoreByNode: {}, findingsByNode: {}, counts: { critical: 0, high: 0, medium: 0, low: 0, none: 0 } };
  let seq = 0;
  const id = () => `rk${++seq}`;
  const sessionRef = (sid: string): EntityRef => {
    const s = data.sessions.find((x) => x.id === sid)!;
    return { kind: "session", id: s.id, label: s.title };
  };

  /* ------------------------------- tasks ------------------------------ */
  for (const t of data.tasks) {
    const ref: EntityRef = { kind: "task", id: t.id, label: t.title };
    const key = nodeKey("task", t.id);

    if (t.status !== "completed" && isOverdue(t.deadline, NOW)) {
      push(report, ref, key, {
        id: id(),
        level: "high",
        rule: "R-OVERDUE",
        title: `${t.title} is overdue`,
        reason: `Deadline passed while the task is still ${t.status.replace("_", " ")} at ${t.progress}% progress.`,
        ref,
        related: [ref],
      });
    }

    if (t.status === "blocked") {
      const blockers = t.dependencyIds.map((d) => data.tasks.find((x) => x.id === d)).filter(Boolean) as typeof data.tasks;
      push(report, ref, key, {
        id: id(),
        level: "high",
        rule: "R-BLOCKED",
        title: `${t.title} is blocked`,
        reason: blockers.length
          ? `Blocked by ${blockers.map((b) => `"${b.title}" (${b.status.replace("_", " ")})`).join(", ")}.`
          : "Marked blocked with no resolvable dependency recorded — needs an owner decision.",
        ref,
        related: blockers.map((b) => ({ kind: "task" as const, id: b.id, label: b.title })),
      });
    }

    if (t.priority === "critical" && t.status === "not_started") {
      push(report, ref, key, {
        id: id(),
        level: "medium",
        rule: "R-UNSTARTED-CRITICAL",
        title: `${t.title} not started`,
        reason: "Critical-priority work that has not begun while the event is live.",
        ref,
        related: [ref],
      });
    }
  }

  /* -------------------- risk propagation across tasks ----------------- */
  for (const t of data.tasks) {
    const blockers = t.dependencyIds.map((d) => data.tasks.find((x) => x.id === d)).filter(Boolean) as typeof data.tasks;
    for (const blocker of blockers) {
      const blockerKey = nodeKey("task", blocker.id);
      const inherited = report.byNode[blockerKey];
      if (inherited && RISK_RANK[inherited] >= RISK_RANK.high) {
        const ref: EntityRef = { kind: "task", id: t.id, label: t.title };
        push(report, ref, nodeKey("task", t.id), {
          id: id(),
          level: inherited === "critical" ? "critical" : "high",
          rule: "R-PROPAGATE",
          title: `${t.title} inherits risk`,
          reason: `Upstream dependency "${blocker.title}" is ${inherited.toUpperCase()}, so this workstream cannot complete on time.`,
          ref,
          related: [
            ref,
            { kind: "task", id: blocker.id, label: blocker.title },
          ],
        });
      }
    }
  }

  /* ---------------------------- resources ----------------------------- */
  for (const r of data.resources) {
    const ref: EntityRef = { kind: "resource", id: r.id, label: r.name };
    const key = nodeKey("resource", r.id);
    const over = r.assigned > r.available;
    const criticalCategory = AV_CATEGORIES.includes(r.category) || r.category === "Power";

    if (r.status === "maintenance" || (over && criticalCategory)) {
      push(report, ref, key, {
        id: id(),
        level: "critical",
        rule: "R-RESOURCE",
        title: `${r.name} unavailable at required volume`,
        reason: over
          ? `Demand exceeds supply by ${r.assigned - r.available} units (${r.assigned} assigned, ${r.available} available).`
          : `Resource is in maintenance while still referenced by live sessions.`,
        ref,
        related: [ref],
      });
    } else if (over) {
      push(report, ref, key, {
        id: id(),
        level: "high",
        rule: "R-RESOURCE",
        title: `${r.name} over-allocated`,
        reason: `Assigned ${r.assigned} exceeds available ${r.available}.`,
        ref,
        related: [ref],
      });
    }
  }

  /* --------------------------- volunteers ----------------------------- */
  for (const v of data.volunteers) {
    const ref: EntityRef = { kind: "volunteer", id: v.id, label: v.name };
    const key = nodeKey("volunteer", v.id);
    if (v.workload > 90) {
      push(report, ref, key, {
        id: id(),
        level: "high",
        rule: "R-WORKLOAD",
        title: `${v.name} is over capacity`,
        reason: `Workload is ${v.workload}% (${v.currentAssignment}). Sustained load above 90% risks fatigue and dropout.`,
        ref,
        related: [ref],
      });
    } else if (v.workload > 80) {
      push(report, ref, key, {
        id: id(),
        level: "medium",
        rule: "R-WORKLOAD",
        title: `${v.name} is heavily loaded`,
        reason: `Workload is ${v.workload}% — approaching the 90% escalation threshold.`,
        ref,
        related: [ref],
      });
    }
  }

  /* ---------------------------- sessions ------------------------------ */
  for (const s of data.sessions) {
    if (s.status === "completed") continue;
    const ref = sessionRef(s.id);
    const key = nodeKey("session", s.id);

    // R-NO-AV — a session with no equipment from an AV-family category.
    const resources = s.resourceIds.map((rid) => data.resources.find((r) => r.id === rid)).filter(Boolean) as typeof data.resources;
    const hasAv = resources.some((r) => AV_CATEGORIES.includes(r.category));
    if (!hasAv && s.expectedAttendance > 200) {
      push(report, ref, key, {
        id: id(),
        level: "high",
        rule: "R-NO-AV",
        title: `${s.title} has no AV resource assigned`,
        reason: `Expected attendance is ${s.expectedAttendance.toLocaleString()} but no projector, microphone, camera or network resource is allocated.`,
        ref,
        related: [ref],
      });
    }

    // R-NO-COVERAGE — no volunteer owns work linked to this session.
    const sessionTasks = data.tasks.filter((t) => t.sessionId === s.id);
    const volunteerCovered = sessionTasks.some((t) => t.ownerKind === "volunteer");
    if (!volunteerCovered) {
      push(report, ref, key, {
        id: id(),
        level: "high",
        rule: "R-NO-COVERAGE",
        title: `${s.title} has no volunteer coverage`,
        reason: `None of the ${sessionTasks.length} linked task(s) are owned by a volunteer.`,
        ref,
        related: [ref],
      });
    }

    // Speaker risk.
    for (const spId of s.speakerIds) {
      const sp = data.speakers.find((x) => x.id === spId);
      if (!sp) continue;
      if (sp.arrivalStatus === "delayed" || !sp.confirmed) {
        push(report, ref, key, {
          id: id(),
          level: "medium",
          rule: "R-SPEAKER",
          title: `${sp.name} is not confirmed on site`,
          reason: `Speaker arrival status is "${sp.arrivalStatus}" for ${s.title}.`,
          ref: { kind: "speaker", id: sp.id, label: sp.name },
          related: [ref, { kind: "speaker", id: sp.id, label: sp.name }],
        });
      }
    }

    // Session already flagged critical by operations.
    if (s.riskLevel === "critical") {
      push(report, ref, key, {
        id: id(),
        level: "critical",
        rule: "R-SESSION-FLAG",
        title: `${s.title} flagged critical by operations`,
        reason: s.notes || "Operations marked this session critical.",
        ref,
        related: [ref],
      });
    }
  }

  /* ------------------------ venue-level conflicts --------------------- */
  for (const r of data.resources) {
    const venue = data.venues.find((v) => r.location.toLowerCase().includes(v.name.toLowerCase().split(" ")[0].toLowerCase()));
    if (!venue) continue;
    if (r.assigned > r.available) {
      const ref: EntityRef = { kind: "venue", id: venue.id, label: venue.name };
      push(report, ref, nodeKey("venue", venue.id), {
        id: id(),
        level: "critical",
        rule: "R-VENUE",
        title: `Resource conflict at ${venue.name}`,
        reason: `${r.name} is over-allocated at this venue (${r.assigned} assigned vs ${r.available} available).`,
        ref,
        related: [ref, { kind: "resource", id: r.id, label: r.name }],
      });
    }
  }

  /* ---------------------------- incidents ----------------------------- */
  for (const i of data.incidents) {
    if (i.status === "resolved" || i.status === "mitigated") continue;
    const nodeKeyStr = i.relatedSessionId
      ? nodeKey("session", i.relatedSessionId)
      : i.relatedResourceId
        ? nodeKey("resource", i.relatedResourceId)
        : nodeKey("incident", i.id);
    const ref: EntityRef = i.relatedSessionId
      ? sessionRef(i.relatedSessionId)
      : i.relatedResourceId
        ? { kind: "resource", id: i.relatedResourceId, label: data.resources.find((r) => r.id === i.relatedResourceId)?.name ?? i.title }
        : { kind: "incident", id: i.id, label: i.title };
    push(report, ref, nodeKeyStr, {
      id: id(),
      level: i.severity === "critical" ? "critical" : i.severity === "warning" ? "high" : "low",
      rule: "R-INCIDENT",
      title: `Open incident: ${i.title}`,
      reason: `${i.severity.toUpperCase()} incident reported by ${i.reportedBy} at ${i.location} is still ${i.status}.`,
      ref,
      related: [ref, { kind: "incident", id: i.id, label: i.title }],
    });
  }

  // Aggregate the highest risk level reached per node.
  for (const key of Object.keys(report.byNode)) {
    report.counts[report.byNode[key]] += 1;
  }
  return report;
}

/** Risk level for an entity reference. */
export function riskLevelFor(report: RiskReport, ref: EntityRef): RiskLevel {
  return report.byNode[nodeKey(ref.kind, ref.id)] ?? "none";
}

export function findingsForRef(report: RiskReport, ref: EntityRef): RiskFinding[] {
  return report.findingsByNode[nodeKey(ref.kind, ref.id)] ?? [];
}
