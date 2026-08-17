import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/leads/lead-form";
import { BackLink } from "@/components/shared/back-link";
import { getLead, listAssignableAgents } from "@/lib/db/leads";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit lead" };

export default async function EditLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabase();

  const lead = await getLead(supabase, profile.organization_id, id);
  if (!lead) notFound();

  const canAssign = profile.role === "admin" || profile.role === "sales_manager";
  const { data: agents } = canAssign
    ? await listAssignableAgents(supabase, profile.organization_id)
    : { data: [] };

  return (
    <div className="space-y-4">
      <BackLink href={`/leads/${lead.id}`} label={lead.full_name} />
      <h1 className="text-xl font-bold tracking-tight">Edit lead</h1>
      <LeadForm lead={lead} agents={agents ?? []} canAssign={canAssign} />
    </div>
  );
}
