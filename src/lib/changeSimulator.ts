import type {
  ChangeRequest,
  EntityRef,
  ImpactAnalysis,
  NexusData,
  RecommendedAction,
  RiskFinding,
  RiskLevel,
  SimulationDiffRow,
  SimulationResult,
} from "@/types";
import { timeOf } from "./format";
import { analyzeImpact } from "./impactAnalyzer";
import { buildDependencyGraph } from "./dependencyEngine";
import { analyzeRisk, type RiskReport } from "./riskEngine";
import { recommendReplacement, recommendForSession } from "./recommendationEngine";

/**
 * NEXUS CHANGE SIMULATOR (Part 2)
 * ======================================================================
 * Simulation is a PURE projection: it never mutates the dataset. The UI
 * previews the blast radius, risks and recommended actions, then either
 * APPLIES (`applyChange`) or DISCARDS.
 */

export interface SimulationContext {
  graph?: ReturnType<typeof buildDependencyGraph>;
  risk?: RiskReport;
}

export function simulateChange(data: NexusData, request: ChangeRequest, ctx: SimulationContext = {}): SimulationResult {
  const graph = ctx.graph ?? buildDependencyGraph(data);
  const risk = ctx.risk ?? analyzeRisk(data);

  const subjectRef: EntityRef = { kind: request.subjectKind, id: request.subjectId, label: request.subjectLabel };
  const headline = `${request.subjectLabel} · ${request.fromValue} → ${request.toValue}`;
  const analysis = analyzeImpact(data, subjectRef, headline, { graph, risk });

  const risks = [...introducedRisk(data, request, subjectRef), ...analysis.riskFindings].slice(0, 8);

  return {
    request,
    headline,
    analysis,
    before: beforeRows(data, request),
    after: afterRows(data, request, analysis),
    risks,
    actions: deriveActions(data, request, analysis),
    aiExplanation: explain(request, analysis),
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------ data rows ------------------------------ */

function beforeRows(data: NexusData, req: ChangeRequest): SimulationDiffRow[] {
  switch (req.kind) {
    case "change_venue":
    case "change_time":
    case "delay_session":
    case "change_team": {
      const s = data.sessions.find((x) => x.id === req.subjectId);
      if (!s) return [];
      const venue = data.venues.find((v) => v.id === s.venueId);
      const team = data.teams.find((t) => t.id === s.teamId);
      const cover = data.tasks.filter((t) => t.sessionId === s.id && t.ownerKind === "volunteer").length;
      const volunteerTotal = data.volunteers.filter((v) => v.teamId === s.teamId && v.status !== "off_duty").length;
      return [
        { label: "Venue", before: venue?.name ?? "—", after: "", tone: "blue" },
        { label: "Start time", before: timeOf(s.startsAt), after: "", tone: "neutral" },
        { label: "End time", before: timeOf(s.endsAt), after: "", tone: "neutral" },
        { label: "Owning team", before: team?.name ?? "—", after: "", tone: "neutral" },
        { label: "Volunteer cover", before: `${cover} linked · ${volunteerTotal} on team`, after: "", tone: "warn" },
        { label: "Equipment", before: `${s.resourceIds.length} allocated`, after: "", tone: "neutral" },
        { label: "Expected attendance", before: s.expectedAttendance.toLocaleString(), after: "", tone: "neutral" },
      ];
    }
    case "remove_volunteer": {
      const v = data.volunteers.find((x) => x.id === req.subjectId);
      if (!v) return [];
      const tasks = data.tasks.filter((t) => t.ownerKind === "volunteer" && t.ownerId === v.id);
      return [
        { label: "Status", before: v.status, after: "", tone: "ok" },
        { label: "Workload", before: `${v.workload}%`, after: "", tone: "ok" },
        { label: "Assignment", before: v.currentAssignment, after: "", tone: "neutral" },
        { label: "Owned tasks", before: `${tasks.length}`, after: "", tone: "neutral" },
        { label: "Shift / zone", before: `${v.shift} · ${v.zone}`, after: "", tone: "neutral" },
      ];
    }
    case "remove_resource": {
      const r = data.resources.find((x) => x.id === req.subjectId);
      if (!r) return [];
      const usedBy = data.sessions.filter((s) => s.resourceIds.includes(r.id)).length;
      return [
        { label: "Status", before: r.status, after: "", tone: "ok" },
        { label: "Available units", before: `${r.available}`, after: "", tone: "ok" },
        { label: "Allocated units", before: `${r.assigned}`, after: "", tone: "neutral" },
        { label: "Sessions depending on it", before: `${usedBy}`, after: "", tone: "warn" },
      ];
    }
  }
}

function afterRows(data: NexusData, req: ChangeRequest, analysis: ImpactAnalysis): SimulationDiffRow[] {
  const base = beforeRows(data, req);
  const post = applyChange(data, req);
  const postSession = post.sessions.find((s) => s.id === req.subjectId);
  const postVenue = postSession ? post.venues.find((v) => v.id === postSession.venueId) : undefined;
  const postTeam = postSession ? post.teams.find((t) => t.id === postSession.teamId) : undefined;
  const postVolunteer = post.volunteers.find((v) => v.id === req.subjectId);
  const postResource = post.resources.find((x) => x.id === req.subjectId);

  return base.map((row) => {
    let after = row.before;
    if (postSession) {
      switch (req.kind) {
        case "change_venue":
          if (row.label === "Venue") after = postVenue?.name ?? row.before;
          if (row.label === "Volunteer cover") after = `${row.before.split(" · ")[0]} · re-plan needed`;
          if (row.label === "Equipment") after = `${Math.max(0, postSession.resourceIds.length - 1)} after re-plan`;
          break;
        case "change_time":
        case "delay_session":
          if (row.label === "Start time") after = timeOf(postSession.startsAt);
          if (row.label === "End time") after = timeOf(postSession.endsAt);
          break;
        case "change_team":
          if (row.label === "Owning team") after = postTeam?.name ?? row.before;
          break;
      }
    }
    if (postVolunteer) {
      if (row.label === "Status") after = "off_duty";
      if (row.label === "Workload") after = "0%";
      if (row.label === "Assignment") after = "Unassigned (removed)";
      if (row.label === "Owned tasks") after = `${row.before} → ${analysis.totalAffected} flagged`;
    }
    if (postResource) {
      if (row.label === "Status") after = "maintenance";
      if (row.label === "Available units") after = "0";
      if (row.label === "Allocated units") after = `${postResource.assigned}`;
    }
    return { ...row, after, tone: after === row.before ? "neutral" : "warn" };
  });
}

/* ------------------------------- risks -------------------------------- */

function introducedRisk(data: NexusData, req: ChangeRequest, subjectRef: EntityRef): RiskFinding[] {
  const out: RiskFinding[] = [];
  const add = (level: RiskLevel, title: string, reason: string, rule: string, ref: EntityRef, related: EntityRef[]) => {
    out.push({ id: `sim-${rule}-${out.length}`, level, title, reason, rule, ref, related });
  };

  if (req.kind === "remove_volunteer") {
    const v = data.volunteers.find((x) => x.id === req.subjectId);
    const tasks = data.tasks.filter((t) => t.ownerKind === "volunteer" && t.ownerId === req.subjectId);
    const critical = tasks.filter((t) => t.priority === "critical" || t.priority === "high");
    add(
      critical.length ? "high" : "medium",
      `${v?.name ?? "Volunteer"} removal leaves ${tasks.length} unowned task${tasks.length === 1 ? "" : "s"}`,
      `Removing this volunteer leaves ${tasks.length} task${tasks.length === 1 ? "" : "s"} (${critical.length} high/critical) without an owner. Reassign before applying.`,
      "S-VOL-REMOVE",
      subjectRef,
      tasks.slice(0, 3).map((t) => ({ kind: "task" as const, id: t.id, label: t.title })),
    );
  }

  if (req.kind === "remove_resource") {
    const r = data.resources.find((x) => x.id === req.subjectId);
    const sessions = data.sessions.filter((s) => s.resourceIds.includes(req.subjectId) && s.status !== "completed");
    add(
      sessions.length >= 2 ? "critical" : "high",
      `${r?.name ?? "Resource"} unavailable for ${sessions.length} live session${sessions.length === 1 ? "" : "s"}`,
      `Removing this resource leaves ${sessions.length} scheduled session${sessions.length === 1 ? "" : "s"} without their allocated equipment.`,
      "S-RES-REMOVE",
      subjectRef,
      sessions.map((s) => ({ kind: "session" as const, id: s.id, label: s.title })),
    );
  }

  if (req.kind === "change_venue") {
    const to = data.venues.find((v) => v.id === req.toId);
    if (to && to.capacity < 600) {
      add("high", `${to.name} has a smaller floor`, `${to.name} seats ${to.capacity.toLocaleString()}, below the expected attendance of main-stage sessions. Plan overflow and entry control.`, "S-VENUE-CAPACITY", { kind: "venue", id: to.id, label: to.name }, [{ kind: "venue", id: to.id, label: to.name }]);
    }
    if (to && to.status !== "healthy") {
      add("critical", `${to.name} is already degraded`, `This venue is currently ${to.status.toUpperCase()}. Adding load compounds existing risk.`, "S-VENUE-HEALTH", { kind: "venue", id: to.id, label: to.name }, [{ kind: "venue", id: to.id, label: to.name }]);
    }
  }

  if (req.kind === "delay_session" || req.kind === "change_time") {
    add("medium", "Downstream schedule compression", `Shifting by ${req.minutes ?? 30} minutes reduces the changeover buffer between consecutive sessions.`, "S-TIME-SHIFT", subjectRef, [subjectRef]);
  }

  return out;
}

/* ------------------------------ actions ------------------------------- */

function deriveActions(data: NexusData, req: ChangeRequest, analysis: ImpactAnalysis): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const affected = (kind: string) => analysis.byKind.find((k) => k.kind === kind)?.count ?? 0;

  if (req.kind === "remove_volunteer") {
    const rec = recommendReplacement(data, req.subjectId);
    if (rec?.best) {
      actions.push({
        id: "act-reassign",
        title: `Reassign cover to ${rec.best.name}`,
        detail: `Skill match ${rec.best.skillMatch}%, workload ${rec.best.workload}%, distance ${rec.best.distance}. ${rec.best.reasons[0]}.`,
        priority: "critical",
        kind: "reassign",
        related: [{ kind: "volunteer", id: rec.best.volunteerId, label: rec.best.name }],
      });
    }
  }

  if (req.kind === "change_venue") {
    const rec = recommendForSession(data, req.subjectId);
    if (rec?.best) {
      actions.push({
        id: "act-venue-cover",
        title: `Stage ${rec.best.name} at the new venue`,
        detail: `Recommended for the relocated session — ${rec.best.reasons.slice(0, 2).join(" · ")}.`,
        priority: "high",
        kind: "reassign",
        related: [{ kind: "volunteer", id: rec.best.volunteerId, label: rec.best.name }],
      });
    }
  }

  const resources = affected("resource");
  if (resources > 0 || req.kind === "remove_resource") {
    actions.push({
      id: "act-procure",
      title: "Re-allocate equipment before applying",
      detail: `${resources || 1} equipment allocation${resources === 1 ? "" : "s"} affected. Pull from low-utilisation stock or raise a procurement request.`,
      priority: "critical",
      kind: "procure",
      related: analysis.sourceRecords.filter((r) => r.kind === "resource").slice(0, 3),
    });
  }

  const volunteers = affected("volunteer");
  if (volunteers > 0) {
    actions.push({
      id: "act-notify-vol",
      title: `Notify ${volunteers} affected volunteer${volunteers === 1 ? "" : "s"}`,
      detail: "Send the updated assignment brief through the volunteer WhatsApp channel.",
      priority: "high",
      kind: "notify",
      related: analysis.sourceRecords.filter((r) => r.kind === "volunteer").slice(0, 4),
    });
  }

  const comms = affected("communication");
  if (comms > 0) {
    actions.push({
      id: "act-comms",
      title: `Update ${comms} attendee communication${comms === 1 ? "" : "s"}`,
      detail: "Drafted announcements reference the changed session details and must be re-issued.",
      priority: "medium",
      kind: "notify",
      related: analysis.sourceRecords.filter((r) => r.kind === "communication").slice(0, 3),
    });
  }

  const sessions = affected("session");
  const tasks = affected("task");
  if (sessions > 0 || tasks > 0) {
    actions.push({
      id: "act-replan",
      title: "Re-plan the run-of-show",
      detail: `${sessions} session${sessions === 1 ? "" : "s"} and ${tasks} task${tasks === 1 ? "" : "s"} sit on the affected path. Confirm timings before applying.`,
      priority: "high",
      kind: "reschedule",
      related: analysis.sourceRecords.filter((r) => r.kind === "session").slice(0, 3),
    });
  }

  if (affected("incident") > 0) {
    actions.push({
      id: "act-incident",
      title: "Attach the change to the open incident",
      detail: "An open incident touches this path — link the change so the audit trail stays complete.",
      priority: "medium",
      kind: "review",
      related: analysis.sourceRecords.filter((r) => r.kind === "incident").slice(0, 2),
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "act-review",
      title: "Review with the department lead",
      detail: "No automated mitigation surfaced. Escalate to the owning team before applying.",
      priority: "low",
      kind: "review",
      related: [analysis.source],
    });
  }

  return actions;
}

/* ----------------------------- explanation ----------------------------- */

function explain(req: ChangeRequest, analysis: ImpactAnalysis): string {
  const breakdown = analysis.byKind.map((k) => `${k.count} ${k.label.toLowerCase()}`).join(", ");
  const subject =
    req.kind === "change_venue"
      ? `Changing the venue for "${req.subjectLabel}" from ${req.fromValue} to ${req.toValue}`
      : req.kind === "remove_volunteer"
        ? `Removing ${req.subjectLabel} from the roster`
        : req.kind === "remove_resource"
          ? `Taking ${req.subjectLabel} out of service`
          : req.kind === "delay_session"
            ? `Delaying "${req.subjectLabel}" by ${req.minutes ?? 30} minutes`
            : req.kind === "change_time"
              ? `Moving "${req.subjectLabel}" by ${req.minutes ?? 30} minutes`
              : `Reassigning "${req.subjectLabel}" from ${req.fromValue} to ${req.toValue}`;

  return (
    `${subject} affects ${analysis.totalAffected} operational item${analysis.totalAffected === 1 ? "" : "s"}${breakdown ? ` (${breakdown})` : ""}. ` +
    `These items are connected in the dependency graph, so the change propagates along declared and structural relationships rather than by proximity. ` +
    `The deterministic risk engine surfaced ${analysis.riskFindings.length} risk condition${analysis.riskFindings.length === 1 ? "" : "s"} while traversing the blast radius, ` +
    `and the impact score settled at ${analysis.impactScore}/100 (${analysis.impactLevel.toUpperCase()}).`
  );
}

/* ------------------------------- apply --------------------------------- */

/** Pure transform: returns a NEW dataset with the change applied. */
export function applyChange(data: NexusData, req: ChangeRequest): NexusData {
  const next: NexusData = clone(data);

  switch (req.kind) {
    case "change_venue": {
      const s = next.sessions.find((x) => x.id === req.subjectId);
      if (s && req.toId) s.venueId = req.toId;
      break;
    }
    case "change_time":
    case "delay_session": {
      const s = next.sessions.find((x) => x.id === req.subjectId);
      if (s) {
        s.startsAt = shiftIso(s.startsAt, req.minutes ?? 30);
        s.endsAt = shiftIso(s.endsAt, req.minutes ?? 30);
      }
      break;
    }
    case "change_team": {
      const s = next.sessions.find((x) => x.id === req.subjectId);
      if (s && req.toId) s.teamId = req.toId;
      const v = next.volunteers.find((x) => x.id === req.subjectId);
      if (v && req.toId) v.teamId = req.toId;
      break;
    }
    case "remove_volunteer": {
      const v = next.volunteers.find((x) => x.id === req.subjectId);
      if (v) {
        v.status = "off_duty";
        v.workload = 0;
        v.currentAssignment = "Unassigned (removed)";
      }
      for (const t of next.tasks) {
        if (t.ownerKind === "volunteer" && t.ownerId === req.subjectId && t.status !== "completed") t.status = "blocked";
      }
      break;
    }
    case "remove_resource": {
      const r = next.resources.find((x) => x.id === req.subjectId);
      if (r) {
        r.available = 0;
        r.status = "maintenance";
      }
      break;
    }
  }

  return next;
}

function shiftIso(iso: string, minutes: number): string {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  const total = (((h * 60 + m + minutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${iso.slice(0, 11)}${hh}:${mm}:00`;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
