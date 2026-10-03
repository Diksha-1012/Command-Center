import type { EntityKind } from "@/types";

/**
 * NEXUS NOTION SCHEMA (Part 3)
 * ======================================================================
 * Canonical definition of the Notion databases NEXUS creates / maps onto the
 * domain model. Relations are declared here so the sync engine can build
 * Notion `relation` properties that preserve the operational graph
 * (Session → Event/Venue/Speaker/Team/Resources/Tasks, Task → Owner/Session,
 *  Volunteer → Team/Assignments, …).
 *
 * This module is pure data — it never touches the network or secrets, so it is
 * safe to import from client code.
 */

export type NotionPropertyType =
  | "title"
  | "rich_text"
  | "select"
  | "multi_select"
  | "number"
  | "date"
  | "checkbox"
  | "url"
  | "relation"
  | "status";

export interface NotionPropertyDef {
  name: string;
  type: NotionPropertyType;
  /** select / multi_select / status options. */
  options?: string[];
  /** Target database key for `relation` properties. */
  relationTo?: string;
  /** Relation cardinality hint used by the sync engine + docs. */
  relation?: "one" | "many";
}

export interface NotionDatabaseDef {
  /** Stable key used by the mapping layer (`events`, `sessions`, …). */
  key: string;
  /** Notion database title. */
  name: string;
  icon: string;
  mappedEntity: EntityKind | "dependency";
  /** The property that acts as the primary key used for upserts. */
  primaryKey: string;
  properties: NotionPropertyDef[];
}

export const NOTION_DATABASES: NotionDatabaseDef[] = [
  {
    key: "events",
    name: "NEXUS Events",
    icon: "🗓️",
    mappedEntity: "event",
    primaryKey: "Event ID",
    properties: [
      { name: "Name", type: "title" },
      { name: "Event ID", type: "rich_text" },
      { name: "Tagline", type: "rich_text" },
      { name: "Date", type: "date" },
      { name: "Phase", type: "select", options: ["preparing", "live", "at_risk", "completed"] },
      { name: "Venue", type: "relation", relationTo: "venues", relation: "one" },
      { name: "Participants", type: "number" },
      { name: "Volunteer Pool", type: "number" },
      { name: "Organizers", type: "multi_select" },
    ],
  },
  {
    key: "venues",
    name: "NEXUS Venues",
    icon: "🏛️",
    mappedEntity: "venue",
    primaryKey: "Venue ID",
    properties: [
      { name: "Name", type: "title" },
      { name: "Venue ID", type: "rich_text" },
      { name: "Building", type: "rich_text" },
      { name: "Capacity", type: "number" },
      { name: "Utilization", type: "number" },
      { name: "Status", type: "status", options: ["healthy", "warning", "critical"] },
      { name: "Features", type: "multi_select" },
      { name: "Sessions", type: "relation", relationTo: "sessions", relation: "many" },
    ],
  },
  {
    key: "sessions",
    name: "NEXUS Sessions",
    icon: "🎤",
    mappedEntity: "session",
    primaryKey: "Session ID",
    properties: [
      { name: "Title", type: "title" },
      { name: "Session ID", type: "rich_text" },
      { name: "Track", type: "select" },
      { name: "Event", type: "relation", relationTo: "events", relation: "one" },
      { name: "Venue", type: "relation", relationTo: "venues", relation: "one" },
      { name: "Speakers", type: "relation", relationTo: "speakers", relation: "many" },
      { name: "Team", type: "relation", relationTo: "teams", relation: "one" },
      { name: "Resources", type: "relation", relationTo: "resources", relation: "many" },
      { name: "Tasks", type: "relation", relationTo: "tasks", relation: "many" },
      { name: "Starts", type: "date" },
      { name: "Ends", type: "date" },
      { name: "Status", type: "status", options: ["scheduled", "live", "delayed", "completed", "at_risk"] },
      { name: "Expected Attendance", type: "number" },
      { name: "Risk", type: "select", options: ["critical", "warning", "info"] },
    ],
  },
  {
    key: "speakers",
    name: "NEXUS Speakers",
    icon: "🎙️",
    mappedEntity: "speaker",
    primaryKey: "Speaker ID",
    properties: [
      { name: "Name", type: "title" },
      { name: "Speaker ID", type: "rich_text" },
      { name: "Title", type: "rich_text" },
      { name: "Organisation", type: "rich_text" },
      { name: "Confirmed", type: "checkbox" },
      { name: "Arrival", type: "select", options: ["confirmed", "pending", "delayed"] },
      { name: "Sessions", type: "relation", relationTo: "sessions", relation: "many" },
    ],
  },
  {
    key: "teams",
    name: "NEXUS Teams",
    icon: "👥",
    mappedEntity: "team",
    primaryKey: "Team ID",
    properties: [
      { name: "Name", type: "title" },
      { name: "Team ID", type: "rich_text" },
      { name: "Lead", type: "relation", relationTo: "members", relation: "one" },
      { name: "Description", type: "rich_text" },
      { name: "Status", type: "status", options: ["healthy", "warning", "critical"] },
      { name: "Members", type: "relation", relationTo: "members", relation: "many" },
      { name: "Volunteers", type: "relation", relationTo: "volunteers", relation: "many" },
    ],
  },
  {
    key: "members",
    name: "NEXUS Members",
    icon: "🧑‍💼",
    mappedEntity: "member",
    primaryKey: "Member ID",
    properties: [
      { name: "Name", type: "title" },
      { name: "Member ID", type: "rich_text" },
      { name: "Role", type: "rich_text" },
      { name: "Team", type: "relation", relationTo: "teams", relation: "one" },
      { name: "Email", type: "url" },
      { name: "Owned Tasks", type: "relation", relationTo: "tasks", relation: "many" },
    ],
  },
  {
    key: "volunteers",
    name: "NEXUS Volunteers",
    icon: "🙋",
    mappedEntity: "volunteer",
    primaryKey: "Volunteer ID",
    properties: [
      { name: "Name", type: "title" },
      { name: "Volunteer ID", type: "rich_text" },
      { name: "Role", type: "rich_text" },
      { name: "Team", type: "relation", relationTo: "teams", relation: "one" },
      { name: "Skills", type: "multi_select" },
      { name: "Availability", type: "rich_text" },
      { name: "Assignment", type: "rich_text" },
      { name: "Workload", type: "number" },
      { name: "Status", type: "select", options: ["assigned", "standby", "available", "off_duty"] },
      { name: "Zone", type: "select" },
      { name: "Shift", type: "select", options: ["A", "B", "C", "FULL"] },
      { name: "Assignments", type: "relation", relationTo: "tasks", relation: "many" },
    ],
  },
  {
    key: "tasks",
    name: "NEXUS Tasks",
    icon: "✅",
    mappedEntity: "task",
    primaryKey: "Task ID",
    properties: [
      { name: "Title", type: "title" },
      { name: "Task ID", type: "rich_text" },
      { name: "Description", type: "rich_text" },
      { name: "Owner", type: "relation", relationTo: "volunteers", relation: "one" },
      { name: "Department", type: "select" },
      { name: "Team", type: "relation", relationTo: "teams", relation: "one" },
      { name: "Priority", type: "select", options: ["low", "medium", "high", "critical"] },
      { name: "Status", type: "status", options: ["not_started", "in_progress", "blocked", "completed"] },
      { name: "Deadline", type: "date" },
      { name: "Progress", type: "number" },
      { name: "Session", type: "relation", relationTo: "sessions", relation: "one" },
      { name: "Resource", type: "relation", relationTo: "resources", relation: "one" },
      { name: "Dependencies", type: "relation", relationTo: "tasks", relation: "many" },
    ],
  },
  {
    key: "resources",
    name: "NEXUS Resources",
    icon: "📦",
    mappedEntity: "resource",
    primaryKey: "Resource ID",
    properties: [
      { name: "Name", type: "title" },
      { name: "Resource ID", type: "rich_text" },
      { name: "Category", type: "select" },
      { name: "Quantity", type: "number" },
      { name: "Available", type: "number" },
      { name: "Assigned", type: "number" },
      { name: "Location", type: "rich_text" },
      { name: "Status", type: "status", options: ["available", "assigned", "in_transit", "maintenance"] },
      { name: "Sessions", type: "relation", relationTo: "sessions", relation: "many" },
    ],
  },
  {
    key: "incidents",
    name: "NEXUS Incidents",
    icon: "🚨",
    mappedEntity: "incident",
    primaryKey: "Incident ID",
    properties: [
      { name: "Title", type: "title" },
      { name: "Incident ID", type: "rich_text" },
      { name: "Severity", type: "select", options: ["critical", "warning", "info"] },
      { name: "Location", type: "rich_text" },
      { name: "Status", type: "status", options: ["open", "investigating", "mitigated", "resolved"] },
      { name: "Owner", type: "relation", relationTo: "members", relation: "one" },
      { name: "Session", type: "relation", relationTo: "sessions", relation: "one" },
      { name: "Resource", type: "relation", relationTo: "resources", relation: "one" },
      { name: "Reported At", type: "date" },
      { name: "Notes", type: "rich_text" },
    ],
  },
  {
    key: "dependencies",
    name: "NEXUS Dependencies",
    icon: "🔗",
    mappedEntity: "dependency",
    primaryKey: "Dependency ID",
    properties: [
      { name: "Name", type: "title" },
      { name: "Dependency ID", type: "rich_text" },
      { name: "Source", type: "rich_text" },
      { name: "Target", type: "rich_text" },
      { name: "Type", type: "select", options: ["venue_shift", "scheduling", "staffing", "equipment", "communication", "approval"] },
      { name: "Severity", type: "select", options: ["critical", "warning", "info"] },
      { name: "Description", type: "rich_text" },
    ],
  },
  {
    key: "communications",
    name: "NEXUS Communications",
    icon: "📣",
    mappedEntity: "communication",
    primaryKey: "Communication ID",
    properties: [
      { name: "Subject", type: "title" },
      { name: "Communication ID", type: "rich_text" },
      { name: "Channel", type: "select", options: ["email", "whatsapp", "slack", "sms", "announcement"] },
      { name: "Audience", type: "rich_text" },
      { name: "Status", type: "status", options: ["drafted", "scheduled", "sent"] },
      { name: "Scheduled At", type: "date" },
      { name: "Session", type: "relation", relationTo: "sessions", relation: "one" },
    ],
  },
  {
    key: "knowledge",
    name: "NEXUS Knowledge",
    icon: "📚",
    mappedEntity: "knowledge",
    primaryKey: "Knowledge ID",
    properties: [
      { name: "Title", type: "title" },
      { name: "Knowledge ID", type: "rich_text" },
      { name: "Category", type: "select" },
      { name: "Summary", type: "rich_text" },
      { name: "Kind", type: "select", options: ["lesson", "incident", "decision", "workflow_success", "workflow_failure", "note"] },
      { name: "Source", type: "rich_text" },
      { name: "Reusable", type: "checkbox" },
      { name: "Captured At", type: "date" },
      { name: "Linked Record", type: "rich_text" },
    ],
  },
];
export const NOTION_DB_BY_KEY: Record<string, NotionDatabaseDef> = Object.fromEntries(
  NOTION_DATABASES.map((d) => [d.key, d]),
);

export function notionDatabaseForEntity(kind: EntityKind): NotionDatabaseDef | undefined {
  return NOTION_DATABASES.find((d) => d.mappedEntity === kind);
}

/** Databases the wizard offers, in the order presented to the user. */
export const WIZARD_DATABASE_ORDER = NOTION_DATABASES.map((d) => d.key);

/** Count of declared relation properties across the whole schema (docs + UI). */
export const NOTION_RELATION_COUNT = NOTION_DATABASES.reduce(
  (n, d) => n + d.properties.filter((p) => p.type === "relation").length,
  0,
);

/** Server-side environment variables the live integration understands. */
export const NOTION_ENV_KEYS: { key: string; secret: boolean; note: string }[] = [
  { key: "NOTION_TOKEN", secret: true, note: "Internal integration secret. Required for live mode." },
  { key: "NOTION_PARENT_PAGE_ID", secret: false, note: "Page the integration was shared with." },
  { key: "NOTION_DB_<KEY>", secret: false, note: "Optional per-database ids for existing databases (e.g. NOTION_DB_TASKS)." },
];
