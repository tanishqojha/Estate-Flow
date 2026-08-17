/** Follow-up note templates (PRD §6.7) — client + server safe. */

export const FOLLOWUP_TEMPLATES = {
  call_back: "Call back to discuss requirements",
  price_sheet: "Share the price sheet and payment plan",
  site_visit: "Confirm the site visit slot",
  loan_docs: "Discuss home loan pre-approval and documents",
  new_options: "Share newly listed matching properties",
  negotiation: "Follow up on the negotiation / offer",
} as const;

export type FollowupTemplateKey = keyof typeof FOLLOWUP_TEMPLATES;

export const FOLLOWUP_TEMPLATE_KEYS = Object.keys(
  FOLLOWUP_TEMPLATES,
) as FollowupTemplateKey[];
