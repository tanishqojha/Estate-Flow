import type {
  AssignmentMode,
  AttendanceStatus,
  AvailabilityStatus,
  CallStatus,
  FollowupStatus,
  FurnishingStatus,
  LeadSource,
  LeadStatus,
  LeadTemperature,
  PropertyType,
  ShareChannel,
  SocialPostType,
  SocialStatus,
  UserRole,
} from "@/lib/types/database";

export * from "@/lib/types/database";

/** DB enum values → human display labels (PRD §5 enums). */
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  "36_acre": "36 Acre",
  magicbricks: "MagicBricks",
  housing: "Housing",
  facebook: "Facebook",
  instagram: "Instagram",
  website: "Website",
  referral: "Referral",
  manual: "Manual",
  other: "Other",
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Apartment",
  villa: "Villa",
  plot: "Plot",
  commercial: "Commercial",
  rental: "Rental",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  site_visit_scheduled: "Site Visit Scheduled",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  not_responding: "Not Responding",
  call_pending: "Call Pending",
};

export const TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  cold: "Cold",
  warm: "Warm",
  hot: "Hot",
};

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: "Available",
  hold: "Hold",
  sold: "Sold",
  rented: "Rented",
};

export const SOCIAL_STATUS_LABELS: Record<SocialStatus, string> = {
  idea: "Idea",
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
};

export const ASSIGNMENT_MODE_LABELS: Record<AssignmentMode, string> = {
  round_robin: "Round Robin",
  manual: "Manual",
  least_busy: "Least Busy Agent",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin / Owner",
  sales_manager: "Sales Manager",
  sales_agent: "Sales Agent",
  field_executive: "Field Executive",
  social_media_manager: "Social Media Manager",
};

export const FURNISHING_LABELS: Record<FurnishingStatus, string> = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi-furnished",
  fully_furnished: "Fully furnished",
};

export const FOLLOWUP_STATUS_LABELS: Record<FollowupStatus, string> = {
  pending: "Pending",
  completed: "Completed",
  snoozed: "Snoozed",
  cancelled: "Cancelled",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  half_day: "Half Day",
};

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  queued: "Queued",
  dialing_agent: "Calling Agent",
  agent_confirmed: "Agent Confirmed",
  dialing_lead: "Calling Lead",
  bridged: "On Call",
  completed: "Completed",
  no_answer: "No Answer",
  busy: "Busy",
  failed: "Failed",
  canceled: "Canceled",
};

export const SHARE_CHANNEL_LABELS: Record<ShareChannel, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "Email",
  link: "Link",
};

export const SOCIAL_POST_TYPE_LABELS: Record<SocialPostType, string> = {
  image: "Image",
  video: "Video",
  reel: "Reel",
  story: "Story",
  carousel: "Carousel",
  text: "Text",
};

/** Standard result envelope for server actions. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; dryRun?: boolean }
  | { ok: false; error: string };
