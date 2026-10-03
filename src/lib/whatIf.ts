import type { ChangeRequest, NexusData, WhatIfScenario } from "@/types";

/**
 * NEXUS WHAT-IF MODE (Part 3)
 * ======================================================================
 * Named, reviewable scenarios that map onto one or more ChangeRequests. Each
 * runs through the SAME change simulator as the Impact Simulator — nothing is
 * special-cased — and can be applied only after human approval.
 */

export const WHAT_IF_SCENARIOS: WhatIfScenario[] = [
  { id: "speaker-cancels", question: "What if the speaker cancels?", icon: "🎙️", hint: "A headline speaker pulls out on the day." },
  { id: "venue-changes", question: "What if the venue changes?", icon: "🏛️", hint: "The room becomes unavailable and must relocate." },
  { id: "volunteers-out", question: "What if 3 volunteers become unavailable?", icon: "🙋", hint: "Illness or no-shows thin the roster." },
  { id: "delay-30", question: "What if the session is delayed 30 minutes?", icon: "⏱️", hint: "A programme item slips by half an hour." },
  { id: "av-fails", question: "What if AV equipment fails?", icon: "📦", hint: "Core stage equipment goes out of service." },
];

export function whatIfById(id: string): WhatIfScenario | undefined {
  return WHAT_IF_SCENARIOS.find((s) => s.id === id);
}

/** Turn a scenario into concrete change requests using the live dataset. */
export function buildWhatIf(id: string, data: NexusData): ChangeRequest[] {
  switch (id) {
    case "speaker-cancels": {
      // The session whose speaker is not yet confirmed on site is the most exposed.
      const target = findSessionWithUnconfirmedSpeaker(data) ?? data.sessions.find((s) => s.id === "s-startup");
      const spId = target?.speakerIds.find((sp) => data.speakers.find((x) => x.id === sp)?.arrivalStatus !== "confirmed");
      const sp = data.speakers.find((x) => x.id === spId) ?? data.speakers.find((x) => x.arrivalStatus !== "confirmed");
      if (!target) return [];
      return [
        {
          kind: "delay_session",
          subjectId: target.id,
          subjectKind: "session",
          subjectLabel: target.title,
          fromValue: `${sp?.name ?? "Speaker"} confirmed`,
          toValue: `${sp?.name ?? "Speaker"} cancelled → session delayed 45m`,
          minutes: 45,
        },
      ];
    }
    case "venue-changes": {
      const s = data.sessions.find((x) => x.id === "s-hack") ?? data.sessions.find((x) => x.venueId === "v-main");
      if (!s) return [];
      const from = data.venues.find((v) => v.id === s.venueId);
      const to = data.venues.find((v) => v.id === "v-innov") ?? data.venues.find((v) => v.id !== s.venueId);
      if (!to) return [];
      return [
        {
          kind: "change_venue",
          subjectId: s.id,
          subjectKind: "session",
          subjectLabel: s.title,
          fromValue: from?.name ?? "—",
          toValue: to.name,
          toId: to.id,
        },
      ];
    }
    case "volunteers-out": {
      const exposed = [...data.volunteers]
        .filter((v) => v.status !== "off_duty")
        .sort((a, b) => b.workload - a.workload)
        .slice(0, 3);
      return exposed.map((v) => ({
        kind: "remove_volunteer" as const,
        subjectId: v.id,
        subjectKind: "volunteer" as const,
        subjectLabel: v.name,
        fromValue: v.currentAssignment,
        toValue: "unavailable",
      }));
    }
    case "delay-30": {
      const s = data.sessions.find((x) => x.id === "s-hack") ?? data.sessions.find((x) => x.status === "live");
      if (!s) return [];
      return [
        {
          kind: "delay_session",
          subjectId: s.id,
          subjectKind: "session",
          subjectLabel: s.title,
          fromValue: "On schedule",
          toValue: "Delayed 30 minutes",
          minutes: 30,
        },
      ];
    }
    case "av-fails": {
      // The main auditorium projection / mic chain underpins the headline session.
      const r = data.resources.find((x) => x.id === "r1") ?? data.resources.find((x) => x.category === "Projectors");
      if (!r) return [];
      return [
        {
          kind: "remove_resource",
          subjectId: r.id,
          subjectKind: "resource",
          subjectLabel: r.name,
          fromValue: `${r.available} available`,
          toValue: "failed / out of service",
        },
      ];
    }
    default:
      return [];
  }
}

function findSessionWithUnconfirmedSpeaker(data: NexusData) {
  return data.sessions.find((s) =>
    s.speakerIds.some((id) => {
      const sp = data.speakers.find((x) => x.id === id);
      return sp ? !sp.confirmed || sp.arrivalStatus !== "confirmed" : false;
    }),
  );
}