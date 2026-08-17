import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Pencil, Phone } from "lucide-react";
import { AssignSelect } from "@/components/leads/assign-select";
import { CallLeadButton } from "@/components/leads/call-lead-button";
import { LeadStatusBadge } from "@/components/leads/lead-badges";
import { LeadTimeline, type TimelineActivity } from "@/components/leads/lead-timeline";
import { DeleteLeadButton } from "@/components/leads/delete-lead-button";
import { NoteForm } from "@/components/leads/note-form";
import { ScheduleFollowupDialog } from "@/components/leads/schedule-followup-dialog";
import { SharePropertySheet } from "@/components/leads/share-property-sheet";
import { StatusSelect } from "@/components/leads/status-select";
import { TemperatureToggle } from "@/components/leads/temperature-toggle";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { getLeadTimeline } from "@/lib/db/activities";
import { getLead, listAssignableAgents } from "@/lib/db/leads";
import { getMatchingProperties, listProperties } from "@/lib/db/properties";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatBudgetRange, formatINR, waLink } from "@/lib/format";
import { LEAD_SOURCE_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabase();

  const lead = await getLead(supabase, profile.organization_id, id);
  if (!lead) notFound();

  const isManager = profile.role === "admin" || profile.role === "sales_manager";
  const [timelineResult, agentsResult, matched, inventory] = await Promise.all([
    getLeadTimeline(supabase, profile.organization_id, lead.id),
    isManager
      ? listAssignableAgents(supabase, profile.organization_id)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    getMatchingProperties(supabase, profile.organization_id, lead),
    listProperties(supabase, profile.organization_id, { page: 1 }),
  ]);

  const activities = (timelineResult.data ?? []) as TimelineActivity[];

  const matchedIds = new Set(matched.map((p) => p.id));
  const shareable = [
    ...matched.map((p) => ({
      id: p.id,
      title: p.title,
      location: p.location,
      price: p.price,
      recommended: true,
    })),
    ...inventory.properties
      .filter(
        (p) =>
          !matchedIds.has(p.id) &&
          p.availability_status !== "sold" &&
          p.availability_status !== "rented",
      )
      .map((p) => ({
        id: p.id,
        title: p.title,
        location: p.location,
        price: p.price,
        recommended: false,
      })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <BackLink href="/leads" label="Leads" />
        <Button asChild variant="ghost" size="sm">
          <Link href={`/leads/${lead.id}/edit`}>
            <Pencil aria-hidden /> Edit
          </Link>
        </Button>
      </div>

      {/* Identity */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight">{lead.full_name}</h1>
          <LeadStatusBadge status={lead.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {LEAD_SOURCE_LABELS[lead.source]}
          {lead.property_type ? ` · ${PROPERTY_TYPE_LABELS[lead.property_type]}` : ""}
          {" · "}
          {formatBudgetRange(lead.budget_min, lead.budget_max)}
        </p>
        {lead.preferred_location ? (
          <p className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            {lead.preferred_location}
          </p>
        ) : null}
      </div>

      {/* One-tap actions (Rules.md §7): call, WhatsApp, share, follow-up */}
      <div className="grid grid-cols-4 gap-2">
        <CallLeadButton leadId={lead.id} />
        <Button asChild variant="outline" size="lg" className="h-auto flex-col gap-1 py-2.5">
          <a href={waLink(lead.phone)} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            <span className="text-xs">WhatsApp</span>
          </a>
        </Button>
        <SharePropertySheet
          leadId={lead.id}
          leadHasEmail={!!lead.email}
          properties={shareable}
        />
        <ScheduleFollowupDialog leadId={lead.id} />
      </div>

      {/* Status + temperature + assignment */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <StatusSelect leadId={lead.id} status={lead.status} />
          </div>
          <div className="space-y-2">
            <Label>Temperature</Label>
            <TemperatureToggle leadId={lead.id} temperature={lead.temperature} />
          </div>
          <div className="space-y-2">
            <Label>Assigned agent</Label>
            {isManager ? (
              <AssignSelect
                leadId={lead.id}
                assignedAgentId={lead.assigned_agent_id}
                agents={agentsResult.data ?? []}
              />
            ) : (
              <p className="text-sm">{lead.assigned_agent?.full_name ?? "Unassigned"}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <Phone className="size-4 text-muted-foreground" aria-hidden />
            <a href={`tel:${lead.phone}`} className="underline-offset-2 hover:underline">
              {lead.phone}
            </a>
          </p>
          {lead.email ? (
            <p className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" aria-hidden />
              <a href={`mailto:${lead.email}`} className="underline-offset-2 hover:underline">
                {lead.email}
              </a>
            </p>
          ) : null}
          {lead.notes ? (
            <p className="whitespace-pre-wrap border-t pt-2 text-muted-foreground">{lead.notes}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Recommended properties (inventory matching, PRD §6.8) */}
      {matched.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recommended properties</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {matched.map((p) => (
              <Link
                key={p.id}
                href={`/properties/${p.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border p-3 hover:bg-accent"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p.location ?? "—"} · {PROPERTY_TYPE_LABELS[p.property_type]}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-primary">
                  {formatINR(p.price)}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NoteForm leadId={lead.id} />
          <LeadTimeline activities={activities} />
        </CardContent>
      </Card>

      {isManager ? (
        <div className="flex justify-center pb-4">
          <DeleteLeadButton leadId={lead.id} leadName={lead.full_name} />
        </div>
      ) : null}
    </div>
  );
}
