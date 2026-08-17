import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { LeadCard } from "@/components/leads/lead-card";
import { LeadFilters } from "@/components/leads/lead-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { LEADS_PAGE_SIZE, listAssignableAgents, listLeads } from "@/lib/db/leads";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";
import { leadFiltersSchema } from "@/lib/validation/lead";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = leadFiltersSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
    source: typeof raw.source === "string" ? raw.source : undefined,
    temperature: typeof raw.temperature === "string" ? raw.temperature : undefined,
    agent: typeof raw.agent === "string" ? raw.agent : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
  });
  const filters = parsed.success
    ? parsed.data
    : leadFiltersSchema.parse({});

  const profile = await requireProfile();
  const supabase = await createServerSupabase();

  const isManager = profile.role === "admin" || profile.role === "sales_manager";
  const [{ leads, total, error }, agentsResult] = await Promise.all([
    listLeads(supabase, profile.organization_id, filters),
    isManager
      ? listAssignableAgents(supabase, profile.organization_id)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
  ]);

  if (error) {
    throw new Error(`Could not load leads: ${error}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const hasFilters = !!(filters.q || filters.status || filters.source || filters.temperature || filters.agent);

  const nextPageParams = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && k !== "page") nextPageParams.set(k, v);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Leads"
        subtitle={`${total} ${total === 1 ? "lead" : "leads"}${isManager ? "" : " assigned to you"}`}
        action={
          <Button asChild>
            <Link href="/leads/new">
              <Plus aria-hidden /> New lead
            </Link>
          </Button>
        }
      />

      <LeadFilters agents={agentsResult.data ?? []} />

      {leads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? "No leads match these filters" : "No leads yet"}
          description={
            hasFilters
              ? "Try widening or clearing the filters."
              : "Add your first lead or connect a lead source webhook."
          }
          action={
            hasFilters ? null : (
              <Button asChild variant="outline">
                <Link href="/leads/new">
                  <Plus aria-hidden /> Add lead
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>

          {filters.page < totalPages ? (
            <div className="flex justify-center pt-2">
              <Button asChild variant="outline">
                <Link
                  href={`/leads?${new URLSearchParams({
                    ...Object.fromEntries(nextPageParams),
                    page: String(filters.page + 1),
                  }).toString()}`}
                >
                  Load more ({total - filters.page * LEADS_PAGE_SIZE} remaining)
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
