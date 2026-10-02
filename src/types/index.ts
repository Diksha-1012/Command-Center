/**
 * NEXUS OPS — Domain Model
 * ------------------------------------------------------------------
 * Central, relational description of every operational entity in an
 * event. UI components must read from these structures (via the store
 * + selector layer) rather than hardcoding content.
 *
 * Part 2/3 extension points are marked with TODO(part2) / TODO(part3).
 */

export type ID = string;

/* ----------------------------- primitives ----------------------------- */

export type Severity = "critical" | "warning" | "info";
export type Health = "healthy" | "warning" | "critical";
export type Priority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "not_started" | "in_progress" | "blocked" | "completed";
export type SessionStatus = "scheduled" | "live" | "delayed" | "completed" | "at_risk";
export type VolunteerLoad = "underloaded" | "balanced" | "overloaded";
export type ResourceStatus = "available" | "assigned" | "in_transit" | "maintenance";
export type EventPhase = "preparing" | "live" | "at_risk" | "completed";

/** The kind of entity a dependency edge points at. */
export type EntityKind =
  | "event"
  | "venue"
  | "session"
  | "speaker"
  | "team"
  | "member"
  | "volunteer"
  | "task"
  | "resource"
  | "communication"
  | "incident"
  | "scheduleItem"
  | "knowledge";

/** Reference to any entity in the graph — enables generic dependency logic. */
export interface EntityRef {
  kind: EntityKind;
  id: ID;
  label: string;
}

/* ------------------------------- core --------------------------------- */

export interface Venue {
  id: ID;
  name: string;
  building: string;
  capacity: number;
  /** Feature flags used by the dependency engine (Part 2). */
  features: string[];
  status: Health;
  utilization: number; // 0..100
}

export interface Speaker {
  id: ID;
  name: string;
  title: string;
  org: string;
  avatarTone: AccentTone;
  confirmed: boolean;
  arrivalStatus: "confirmed" | "pending" | "delayed";
}

export interface Session {
  id: ID;
  eventId: ID;
  title: string;
  track: string;
  venueId: ID;
  speakerIds: ID[];
  teamId: ID;
  startsAt: string; // ISO
  endsAt: string; // ISO
  status: SessionStatus;
  expectedAttendance: number;
  /** Equipment/resource ids this session depends on. */
  resourceIds: ID[];
  riskLevel: Severity;
  notes: string;
}

export interface Member {
  id: ID;
  name: string;
  role: string;
  teamId: ID;
  email: string;
  avatarTone: AccentTone;
}

export interface Team {
  id: ID;
  name: string;
  leadMemberId: ID;
  description: string;
  status: Health;
}

export type ShiftBand = "A" | "B" | "C" | "FULL";

export interface Volunteer {
  id: ID;
  name: string;
  role: string;
  teamId: ID;
  skills: string[];
  availability: string;
  currentAssignment: string;
  workload: number; // 0..100
  status: "assigned" | "standby" | "available" | "off_duty";
  avatarTone: AccentTone;
  /** Physical zone — drives the recommendation engine's distance heuristic. */
  zone: string;
  /** Working shift band — drives recommendation shift-overlap scoring. */
  shift: ShiftBand;
}

export interface Task {
  id: ID;
  title: string;
  description: string;
  ownerId: ID; // member or volunteer id
  ownerKind: "member" | "volunteer";
  department: string;
  teamId: ID;
  priority: Priority;
  status: TaskStatus;
  deadline: string; // ISO
  progress: number; // 0..100
  dependencyIds: ID[]; // depends on these task ids
  sessionId?: ID;
  resourceId?: ID;
}

export interface ResourceItem {
  id: ID;
  name: string;
  category: string;
  quantity: number;
  available: number;
  assigned: number;
  location: string;
  status: ResourceStatus;
}

export type DependencyType =
  | "venue_shift"
  | "scheduling"
  | "staffing"
  | "equipment"
  | "communication"
  | "approval";

export interface Dependency {
  id: ID;
  source: EntityRef;
  target: EntityRef;
  type: DependencyType;
  severity: Severity;
  description: string;
}

export interface Alert {
  id: ID;
  severity: Severity;
  title: string;
  description: string;
  timestamp: string; // ISO
  related: EntityRef;
  suggestedAction: string;
  acknowledged: boolean;
}

export interface Communication {
  id: ID;
  channel: "email" | "whatsapp" | "slack" | "sms" | "announcement";
  audience: string;
  subject: string;
  status: "drafted" | "scheduled" | "sent";
  scheduledAt: string;
  relatedSessionId?: ID;
}

export interface ScheduleItem {
  id: ID;
  sessionId: ID;
  order: number;
}

export interface KnowledgeItem {
  id: ID;
  title: string;
  category: string;
  summary: string;
  updatedAt: string;
  notionPageId: string;
  linkedEntity?: EntityRef;
}

export interface EventRecord {
  id: ID;
  name: string;
  tagline: string;
  date: string; // ISO
  venueId: ID;
  phase: EventPhase;
  organizers: string[];
  /** Registered attendees. */
  participantTarget: number;
  /** Total registered volunteer pool (detail records are a subset). */
  volunteerPool: number;
  /** Total programme items including sub-blocks. */
  programmeItems: number;
}

/* --------------------------- presentation ----------------------------- */

export type AccentTone = "ai" | "ok" | "warn" | "bad" | "blue" | "neutral";

export interface HealthMetric {
  label: string;
  score: number; // 0..100
}

export interface PulseItem {
  id: ID;
  label: string;
  detail: string;
  health: Health;
  entity: EntityRef;
  metric?: string;
}

/* --------------------------- Notion layer ----------------------------- */

export type NotionMode = "demo" | "live";

export interface NotionDatabase {
  id: ID;
  name: string;
  icon: string;
  rowCount: number;
  mappedEntity: EntityKind | "none";
  lastEdited: string;
}

export interface NotionState {
  mode: NotionMode;
  connected: boolean;
  workspaceName: string;
  lastSyncAt: string | null;
  syncing: boolean;
  /** Part 3 TODO: real OAuth token + API client. */
  hasToken: boolean;
}

/* ------------------------------ copilot ------------------------------- */

export type CopilotSource = "verified" | "generated";

export interface CopilotMessage {
  id: ID;
  role: "user" | "assistant";
  content: string;
  source?: CopilotSource;
  /** Structured evidence backing a verified answer. */
  citations?: string[];
  /** Clickable source records. */
  sources?: EntityRef[];
  /** 0..100 confidence in the answer. */
  confidence?: number;
  /** WHY the answer holds — explainability. */
  why?: string;
  createdAt: string;
}

/* ===================================================================== */
/* PART 2 — DEPENDENCY INTELLIGENCE LAYER                                 */
/* ===================================================================== */

/* ------------------------------ risk ---------------------------------- */

export type RiskLevel = "critical" | "high" | "medium" | "low" | "none";

export interface RiskFinding {
  id: ID;
  level: RiskLevel;
  /** Short human-readable headline. */
  title: string;
  /** WHY this is at risk — the deterministic explanation. */
  reason: string;
  /** Stable id of the rule that fired. */
  rule: string;
  ref?: EntityRef;
  /** Records that evidence the finding (clickable source chips). */
  related: EntityRef[];
}

export interface EntityRisk {
  ref: EntityRef;
  level: RiskLevel;
  score: number; // 0..100
  findings: RiskFinding[];
}

/* -------------------------- dependency graph -------------------------- */

export type GraphNodeType = EntityKind | "incident";

/** Typed relationships carried by graph edges. */
export type EdgeKind =
  | "REQUIRES"
  | "ASSIGNED_TO"
  | "LOCATED_AT"
  | "DEPENDS_ON"
  | "AFFECTS"
  | "OWNED_BY"
  | "USES"
  | "COMMUNICATES_TO";

export interface GraphNode {
  /** Canonical key: `${type}:${id}` */
  key: string;
  id: ID;
  type: GraphNodeType;
  name: string;
  status: string;
  risk: RiskLevel;
  owner?: string;
  ref: EntityRef;
}

export interface GraphEdge {
  id: ID;
  from: string; // node key
  to: string; // node key
  kind: EdgeKind;
  /** Propagation strength 0..1 used by the blast-radius scorer. */
  weight: number;
  reason: string;
}

export interface DependencyGraph {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  out: Record<string, GraphEdge[]>;
  in: Record<string, GraphEdge[]>;
}

/* -------------------------- impact analysis --------------------------- */

export interface ImpactNode {
  kind: EntityKind;
  id: ID;
  label: string;
  severity: Severity;
  reason: string;
  depth: number; // hop distance from the changed node
  /** Which edge kind carried the propagation. */
  via: EdgeKind;
  /** 0..1 confidence that this item is genuinely affected. */
  confidence: number;
}

export interface ImpactAnalysis {
  source: EntityRef;
  change: string;
  /** hop 1 */
  direct: ImpactNode[];
  /** hop 2-3 */
  indirect: ImpactNode[];
  /** hop 4+ — worth watching, not confirmed */
  potential: ImpactNode[];
  byKind: { kind: GraphNodeType; label: string; count: number }[];
  totalAffected: number;
  impactScore: number; // 0..100
  impactLevel: RiskLevel;
  /** WHY the score is what it is. */
  scoreReasons: string[];
  riskFindings: RiskFinding[];
  /** Verified records backing the analysis. */
  sourceRecords: EntityRef[];
  generatedAt: string;
  engine: "graph";
}

/* ------------------------- change simulation -------------------------- */

export type ChangeKind =
  | "change_venue"
  | "change_time"
  | "delay_session"
  | "remove_volunteer"
  | "remove_resource"
  | "change_team";

export interface ChangeRequest {
  kind: ChangeKind;
  /** Entity the change is applied to. */
  subjectId: ID;
  subjectKind: EntityKind;
  subjectLabel: string;
  fromValue: string;
  toValue: string;
  toId?: ID;
  minutes?: number;
}

export interface SimulationDiffRow {
  label: string;
  before: string;
  after: string;
  tone: AccentTone;
}

export interface RecommendedAction {
  id: ID;
  title: string;
  detail: string;
  priority: Priority;
  kind: "reassign" | "procure" | "notify" | "reschedule" | "review";
  related: EntityRef[];
}

export interface SimulationResult {
  request: ChangeRequest;
  headline: string;
  analysis: ImpactAnalysis;
  before: SimulationDiffRow[];
  after: SimulationDiffRow[];
  risks: RiskFinding[];
  actions: RecommendedAction[];
  /** AI-generated narrative — always labelled as generated in the UI. */
  aiExplanation: string;
  generatedAt: string;
}

/* -------------------------- recommendations --------------------------- */

export interface CandidateScore {
  volunteerId: ID;
  name: string;
  role: string;
  skillMatch: number; // 0..100
  availability: number; // 0..100
  workload: number; // raw current workload 0..100
  distance: "low" | "medium" | "high";
  shiftOverlap: number; // 0..100
  total: number; // 0..100 blended score
  reasons: string[];
}

export interface AssignmentRecommendation {
  role: string;
  context: string;
  requiredSkills: string[];
  targetShift: ShiftBand;
  targetZone: string;
  best: CandidateScore | null;
  alternatives: CandidateScore[];
}

/* ------------------------------ workload ------------------------------ */

export interface TeamLoad {
  teamId: ID;
  name: string;
  load: number; // 0..100
  volunteers: number;
  openTasks: number;
  overloaded: boolean;
  /** WHY the load is what it is. */
  drivers: string[];
}

export interface RebalanceMove {
  id: ID;
  fromTeamId: ID;
  toTeamId: ID;
  volunteerId: ID;
  volunteerName: string;
  reason: string;
  expectedDelta: number;
}

/* ------------------------------ incidents ----------------------------- */

export type IncidentStatus = "open" | "investigating" | "mitigated" | "resolved";

export interface Incident {
  id: ID;
  title: string;
  severity: Severity;
  location: string;
  reportedBy: ID;
  ownerId: ID;
  status: IncidentStatus;
  relatedSessionId?: ID;
  relatedResourceId?: ID;
  timestamp: string; // ISO
  notes: string;
}

/* ------------------------------ timeline ------------------------------ */

export type ActivityKind =
  | "change"
  | "impact"
  | "detection"
  | "recommendation"
  | "approval"
  | "sync"
  | "incident"
  | "alert";

export interface ActivityEvent {
  id: ID;
  at: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  actor?: string;
  related?: EntityRef[];
}

/* --------------------------- full dataset ----------------------------- */

export interface NexusData {
  event: EventRecord;
  venues: Venue[];
  speakers: Speaker[];
  sessions: Session[];
  teams: Team[];
  members: Member[];
  volunteers: Volunteer[];
  tasks: Task[];
  resources: ResourceItem[];
  dependencies: Dependency[];
  alerts: Alert[];
  communications: Communication[];
  schedule: ScheduleItem[];
  knowledge: KnowledgeItem[];
  notion: NotionState;
  notionDatabases: NotionDatabase[];
  healthMetrics: HealthMetric[];
  incidents: Incident[];
  activity: ActivityEvent[];
}
