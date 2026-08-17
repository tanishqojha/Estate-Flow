import type {
  AssignmentMode,
  AttendanceStatus,
  MessageChannel,
  ShareChannel,
} from "@/lib/types/database";

/**
 * Service adapter contracts (Rules.md §4).
 * Every adapter has a production path and a dry-run path behind the same
 * interface. Adapters perform EXTERNAL I/O only — DB writes happen in the
 * db layer, orchestrated by server actions (golden path).
 */

/** Common envelope: every adapter result reports whether it was simulated. */
export interface AdapterResult {
  dryRun: boolean;
}

// --- callService ------------------------------------------------------------
export interface StartBridgeParams {
  /** E.164 phone of the agent to dial first. */
  agentPhone: string;
  /** E.164 phone of the lead to bridge after agent confirms. */
  leadPhone: string;
  /** Our internal call row id — embedded in callback URLs. */
  callId: string;
  organizationId: string;
  /** Human context read to the agent ("New lead: Asha, 2BHK Baner…"). */
  announcement: string;
}

export interface StartBridgeResult extends AdapterResult {
  ok: boolean;
  /** Provider call SID for the agent leg (simulated in dry-run). */
  callSid: string | null;
  /** Conference room name/SID once created. */
  conferenceSid: string | null;
  error?: string;
}

export interface DialLeadParams {
  leadPhone: string;
  /** Conference room both legs join (conf_<callId>). */
  conferenceName: string;
  /** Our internal call row id — embedded in callback URLs. */
  callId: string;
  organizationId: string;
}

export interface CallService {
  readonly dryRun: boolean;
  startBridge(params: StartBridgeParams): Promise<StartBridgeResult>;
  /** Second leg: dial the lead into the conference after agent confirms. */
  dialLeadIntoConference(
    params: DialLeadParams,
  ): Promise<AdapterResult & { ok: boolean; callSid: string | null; error?: string }>;
  /** Terminate an in-flight bridge (best effort). */
  cancelCall(callSid: string): Promise<AdapterResult & { ok: boolean }>;
}

// --- messageService (WhatsApp / SMS) ----------------------------------------
export interface SendMessageParams {
  channel: Exclude<MessageChannel, "email">;
  /** E.164 destination. */
  to: string;
  body: string;
  organizationId: string;
}

export interface SendMessageResult extends AdapterResult {
  ok: boolean;
  providerMessageId: string | null;
  error?: string;
}

export interface MessageService {
  readonly dryRun: boolean;
  send(params: SendMessageParams): Promise<SendMessageResult>;
}

// --- emailService ------------------------------------------------------------
export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  organizationId: string;
}

export interface SendEmailResult extends AdapterResult {
  ok: boolean;
  providerMessageId: string | null;
  error?: string;
}

export interface EmailService {
  readonly dryRun: boolean;
  send(params: SendEmailParams): Promise<SendEmailResult>;
}

// --- leadAssignmentService ----------------------------------------------------
/** Candidate agent snapshot the db layer feeds into the picker. */
export interface AssignableAgent {
  id: string;
  fullName: string;
  /** Open (non-won/lost) leads currently assigned. */
  activeLeadCount: number;
  /** Most recent lead assignment; null if never assigned. */
  lastAssignedAt: string | null;
}

export interface LeadAssignmentService {
  /**
   * Pure selection logic — identical in prod and dry-run (no external I/O).
   * Returns null when mode is 'manual' or no candidates exist.
   */
  pickAgent(mode: AssignmentMode, candidates: AssignableAgent[]): AssignableAgent | null;
  /** Ordered fallback queue for the call bridge (next agent on no-answer). */
  orderFallbackQueue(mode: AssignmentMode, candidates: AssignableAgent[]): AssignableAgent[];
}

// --- propertyShareService ------------------------------------------------------
export interface ShareMessageInput {
  leadName: string;
  propertyTitle: string;
  location: string | null;
  price: number | null;
  shareUrl: string;
  agentName: string;
}

export interface PropertyShareService {
  /** Absolute public share link for a property. */
  buildShareUrl(shareSlug: string): string;
  /** Channel-appropriate message text from the standard template. */
  buildShareMessage(channel: ShareChannel, input: ShareMessageInput): string;
}

// --- attendanceService ----------------------------------------------------------
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface AttendanceService {
  /** Validate GPS coords are plausible (range checks). */
  validateLocation(point: GeoPoint): boolean;
  /** Derive present/late from check-in time in the org timezone. */
  deriveCheckInStatus(checkInTime: Date, timezone: string): AttendanceStatus;
  /** Storage path for a selfie: <org>/<user>/<date>-selfie.jpg */
  buildSelfiePath(organizationId: string, userId: string, workDate: string): string;
}

// --- socialPostService ------------------------------------------------------------
export interface DispatchPostParams {
  postId: string;
  organizationId: string;
  title: string;
  caption: string | null;
  postType: string;
  platforms: string[];
  scheduledFor: string | null;
  mediaUrls: string[];
}

export interface DispatchPostResult extends AdapterResult {
  ok: boolean;
  statusCode: number | null;
  responseBody: string | null;
  error?: string;
}

export interface SocialPostService {
  readonly dryRun: boolean;
  /** POST the approved post to the org's external webhook (Zapier/Make/Buffer). */
  dispatch(params: DispatchPostParams): Promise<DispatchPostResult>;
}
