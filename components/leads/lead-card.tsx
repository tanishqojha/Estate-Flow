import Link from "next/link";
import { MapPin, MessageCircle, Phone, UserRound } from "lucide-react";
import { LeadStatusBadge, TemperatureBadge } from "@/components/leads/lead-badges";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { LeadWithAgent } from "@/lib/db/leads";
import { LEAD_SOURCE_LABELS } from "@/lib/types";
import { formatBudgetRange, waLink } from "@/lib/format";

/** Compact, thumb-friendly lead card: whole card links to detail; the two
 *  high-frequency actions (call / WhatsApp) stay one tap (Rules.md §7). */
export function LeadCard({ lead }: { lead: LeadWithAgent }) {
  return (
    <Card className="relative p-4 transition-[transform,border-color] has-[a:hover]:border-ring/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100">
      <Link
        href={`/leads/${lead.id}`}
        className="absolute inset-0 z-0 rounded-xl outline-none"
        aria-label={`Open lead ${lead.full_name}`}
      />
      <div className="pointer-events-none relative z-10 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{lead.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {LEAD_SOURCE_LABELS[lead.source]} · {formatBudgetRange(lead.budget_min, lead.budget_max)}
            </p>
          </div>
          <TemperatureBadge temperature={lead.temperature} />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <LeadStatusBadge status={lead.status} />
          {lead.preferred_location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden />
              {lead.preferred_location}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <UserRound className="size-3" aria-hidden />
            {lead.assigned_agent?.full_name ?? "Unassigned"}
          </span>
        </div>
      </div>

      <div className="relative z-10 mt-3 flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a href={`tel:${lead.phone}`} aria-label={`Call ${lead.full_name}`}>
            <Phone aria-hidden /> Call
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a
            href={waLink(lead.phone)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`WhatsApp ${lead.full_name}`}
          >
            <MessageCircle aria-hidden /> WhatsApp
          </a>
        </Button>
      </div>
    </Card>
  );
}
