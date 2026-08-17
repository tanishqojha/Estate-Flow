import type { Metadata } from "next";
import { LeadForm } from "@/components/leads/lead-form";
import { BackLink } from "@/components/shared/back-link";
import { listAssignableAgents } from "@/lib/db/leads";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New lead" };

export default async function NewLeadPage() {
  const profile = await requireProfile();
  const supabase = await createServerSupabase();
  const canAssign = profile.role === "admin" || profile.role === "sales_manager";
  const { data: agents } = canAssign
    ? await listAssignableAgents(supabase, profile.organization_id)
    : { data: [] };

  return (
    <div className="space-y-4">
      <BackLink href="/leads" label="Leads" />
      <h1 className="text-xl font-bold tracking-tight">New lead</h1>
      <LeadForm agents={agents ?? []} canAssign={canAssign} />
    </div>
  );
}
