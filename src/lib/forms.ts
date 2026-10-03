import type { CollectionKey } from "@/store/DataContext";

/**
 * DATA STUDIO FORM CONFIG
 * ======================================================================
 * Declarative field definitions for creating real operational records in the
 * active workspace. Every form writes through the store's `createEntity`, so
 * records land in the actual data layer with `sourceType` provenance attached
 * automatically (live records in LIVE mode, demo records in DEMO mode).
 */

export type FieldKind = "text" | "textarea" | "number" | "select" | "datetime" | "date" | "ref";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[];
  /** Which collection a `ref` field points at (renders a live dropdown). */
  refCollection?: CollectionKey;
  placeholder?: string;
  defaultValue?: string | number;
  /** Display helper for the option label. */
  optionLabel?: "name" | "title" | "subject";
}

export interface EntityFormConfig {
  key: CollectionKey;
  label: string;
  singular: string;
  icon: string;
  blurb: string;
  fields: FieldDef[];
}

const STATUS_HEALTH = ["healthy", "warning", "critical"];

export const ENTITY_FORMS: EntityFormConfig[] = [
  {
    key: "venues",
    label: "Venues",
    singular: "venue",
    icon: "🏛️",
    blurb: "Physical spaces, capacity and live load.",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true, placeholder: "Main Auditorium" },
      { key: "building", label: "Building", kind: "text", placeholder: "Convention Centre" },
      { key: "capacity", label: "Capacity", kind: "number", defaultValue: 100 },
      { key: "features", label: "Features (comma separated)", kind: "text", placeholder: "Stage, Projection" },
      { key: "status", label: "Status", kind: "select", options: STATUS_HEALTH, defaultValue: "healthy" },
      { key: "utilization", label: "Utilization %", kind: "number", defaultValue: 0 },
    ],
  },
  {
    key: "sessions",
    label: "Sessions",
    singular: "session",
    icon: "🎤",
    blurb: "Programme items with venue, team and time.",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true, placeholder: "Opening Ceremony" },
      { key: "track", label: "Track", kind: "text", placeholder: "Main" },
      { key: "venueId", label: "Venue", kind: "ref", refCollection: "venues" },
      { key: "teamId", label: "Team", kind: "ref", refCollection: "teams" },
      { key: "startsAt", label: "Starts at", kind: "datetime", required: true },
      { key: "endsAt", label: "Ends at", kind: "datetime", required: true },
      { key: "status", label: "Status", kind: "select", options: ["scheduled", "live", "delayed", "completed", "at_risk"], defaultValue: "scheduled" },
      { key: "expectedAttendance", label: "Expected attendance", kind: "number", defaultValue: 0 },
      { key: "riskLevel", label: "Risk level", kind: "select", options: ["info", "warning", "critical"], defaultValue: "info" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  {
    key: "teams",
    label: "Teams",
    singular: "team",
    icon: "👥",
    blurb: "Departments that own the run-of-show.",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true, placeholder: "Operations" },
      { key: "leadMemberId", label: "Lead member", kind: "ref", refCollection: "members" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "status", label: "Status", kind: "select", options: STATUS_HEALTH, defaultValue: "healthy" },
    ],
  },
  {
    key: "members",
    label: "Members",
    singular: "member",
    icon: "🧑‍💼",
    blurb: "Core team members and their owners.",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true, placeholder: "Aisha Khan" },
      { key: "role", label: "Role", kind: "text", placeholder: "Operations Lead" },
      { key: "teamId", label: "Team", kind: "ref", refCollection: "teams" },
      { key: "email", label: "Email", kind: "text", placeholder: "name@example.com" },
    ],
  },
  {
    key: "volunteers",
    label: "Volunteers",
    singular: "volunteer",
    icon: "🙋",
    blurb: "The volunteer roster with skills and shifts.",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true, placeholder: "Aarav Sharma" },
      { key: "role", label: "Role", kind: "text", placeholder: "Technical Volunteer" },
      { key: "teamId", label: "Team", kind: "ref", refCollection: "teams" },
      { key: "skills", label: "Skills (comma separated)", kind: "text", placeholder: "AV, Networking" },
      { key: "availability", label: "Availability", kind: "text", placeholder: "Full day · 08:00–20:00" },
      { key: "currentAssignment", label: "Current assignment", kind: "text", placeholder: "Main Stage AV desk" },
      { key: "workload", label: "Workload %", kind: "number", defaultValue: 50 },
      { key: "status", label: "Status", kind: "select", options: ["assigned", "standby", "available", "off_duty"], defaultValue: "available" },
      { key: "zone", label: "Zone", kind: "text", placeholder: "Main Stage" },
      { key: "shift", label: "Shift", kind: "select", options: ["A", "B", "C", "FULL"], defaultValue: "FULL" },
    ],
  },
  {
    key: "participants",
    label: "Participants",
    singular: "participant",
    icon: "🎟️",
    blurb: "Registered attendees, tickets and check-in status.",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true, placeholder: "Aditi Rao" },
      { key: "email", label: "Email", kind: "text", placeholder: "name@example.com" },
      { key: "ticketType", label: "Ticket type", kind: "text", placeholder: "Full Access" },
      { key: "sessionId", label: "Registered session", kind: "ref", refCollection: "sessions" },
      { key: "teamId", label: "Owning team", kind: "ref", refCollection: "teams" },
      { key: "status", label: "Status", kind: "select", options: ["registered", "checked_in", "no_show", "cancelled"], defaultValue: "registered" },
    ],
  },
  {
    key: "tasks",
    label: "Tasks",
    singular: "task",
    icon: "✅",
    blurb: "Responsibilities with owners, deadlines and blockers.",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true, placeholder: "Confirm AV line check" },
      { key: "description", label: "Description", kind: "textarea" },
      { key: "ownerId", label: "Owner", kind: "ref", refCollection: "members" },
      { key: "department", label: "Department", kind: "text", placeholder: "Operations" },
      { key: "teamId", label: "Team", kind: "ref", refCollection: "teams" },
      { key: "priority", label: "Priority", kind: "select", options: ["low", "medium", "high", "critical"], defaultValue: "medium" },
      { key: "status", label: "Status", kind: "select", options: ["not_started", "in_progress", "blocked", "completed"], defaultValue: "not_started" },
      { key: "deadline", label: "Deadline", kind: "datetime", required: true },
      { key: "sessionId", label: "Related session", kind: "ref", refCollection: "sessions" },
    ],
  },
  {
    key: "resources",
    label: "Resources",
    singular: "resource",
    icon: "📦",
    blurb: "Equipment inventory and allocation.",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true, placeholder: "Stage Projectors (4K)" },
      { key: "category", label: "Category", kind: "text", placeholder: "Projectors" },
      { key: "quantity", label: "Quantity", kind: "number", defaultValue: 1 },
      { key: "available", label: "Available", kind: "number", defaultValue: 1 },
      { key: "assigned", label: "Assigned", kind: "number", defaultValue: 0 },
      { key: "location", label: "Location", kind: "text", placeholder: "AV Store" },
      { key: "status", label: "Status", kind: "select", options: ["available", "assigned", "in_transit", "maintenance"], defaultValue: "available" },
    ],
  },
  {
    key: "dependencies",
    label: "Dependencies",
    singular: "dependency",
    icon: "🔗",
    blurb: "Declared relationships that feed the impact engine.",
    fields: [
      { key: "sourceLabel", label: "Source label", kind: "text", required: true, placeholder: "Main Auditorium" },
      { key: "sourceKind", label: "Source kind", kind: "select", options: ["event", "venue", "session", "speaker", "team", "member", "volunteer", "task", "resource", "communication", "incident"], defaultValue: "venue" },
      { key: "sourceId", label: "Source id", kind: "text", placeholder: "v-main" },
      { key: "targetLabel", label: "Target label", kind: "text", required: true, placeholder: "Hackathon Final Pitch" },
      { key: "targetKind", label: "Target kind", kind: "select", options: ["event", "venue", "session", "speaker", "team", "member", "volunteer", "task", "resource", "communication", "incident"], defaultValue: "session" },
      { key: "targetId", label: "Target id", kind: "text", placeholder: "s-hack" },
      { key: "type", label: "Type", kind: "select", options: ["venue_shift", "scheduling", "staffing", "equipment", "communication", "approval"], defaultValue: "scheduling" },
      { key: "severity", label: "Severity", kind: "select", options: ["info", "warning", "critical"], defaultValue: "warning" },
      { key: "description", label: "Description", kind: "textarea" },
    ],
  },
  {
    key: "communications",
    label: "Communications",
    singular: "communication",
    icon: "📣",
    blurb: "Planned and sent messages to audiences.",
    fields: [
      { key: "subject", label: "Subject", kind: "text", required: true, placeholder: "Gate open announcement" },
      { key: "channel", label: "Channel", kind: "select", options: ["email", "whatsapp", "slack", "sms", "announcement"], defaultValue: "announcement" },
      { key: "audience", label: "Audience", kind: "text", placeholder: "All Attendees" },
      { key: "status", label: "Status", kind: "select", options: ["drafted", "scheduled", "sent"], defaultValue: "drafted" },
      { key: "scheduledAt", label: "Scheduled at", kind: "datetime" },
    ],
  },
  {
    key: "incidents",
    label: "Incidents",
    singular: "incident",
    icon: "🚨",
    blurb: "What broke, who owns it and its blast radius.",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true, placeholder: "Projector failure on stage-left" },
      { key: "severity", label: "Severity", kind: "select", options: ["info", "warning", "critical"], defaultValue: "warning" },
      { key: "location", label: "Location", kind: "text", placeholder: "Main Auditorium" },
      { key: "ownerId", label: "Owner", kind: "ref", refCollection: "members" },
      { key: "relatedSessionId", label: "Related session", kind: "ref", refCollection: "sessions" },
      { key: "status", label: "Status", kind: "select", options: ["open", "investigating", "mitigated", "resolved"], defaultValue: "open" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  {
    key: "knowledge",
    label: "Knowledge",
    singular: "knowledge item",
    icon: "📚",
    blurb: "Playbooks and reference documents.",
    fields: [
      { key: "title", label: "Title", kind: "text", required: true, placeholder: "AV Setup Checklist" },
      { key: "category", label: "Category", kind: "text", placeholder: "Technical" },
      { key: "summary", label: "Summary", kind: "textarea" },
    ],
  },
  {
    key: "speakers",
    label: "Speakers",
    singular: "speaker",
    icon: "🎙️",
    blurb: "Confirmed speakers and arrival status.",
    fields: [
      { key: "name", label: "Name", kind: "text", required: true, placeholder: "Dr. Meera Krishnan" },
      { key: "title", label: "Title", kind: "text", placeholder: "Chief Scientist" },
      { key: "org", label: "Organisation", kind: "text", placeholder: "Aether AI" },
      { key: "confirmed", label: "Confirmed", kind: "select", options: ["true", "false"], defaultValue: "true" },
      { key: "arrivalStatus", label: "Arrival", kind: "select", options: ["confirmed", "pending", "delayed"], defaultValue: "pending" },
    ],
  },
];

export const ENTITY_FORM_BY_KEY: Record<string, EntityFormConfig> = Object.fromEntries(
  ENTITY_FORMS.map((f) => [f.key, f]),
);

/** Splits a comma-separated field into a trimmed string array. */
export function splitList(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
