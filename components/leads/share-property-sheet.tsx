"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, MessageCircle, MessageSquare, Link2, Share2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { sharePropertyAction } from "@/app/actions/share";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatINR } from "@/lib/format";
import type { ShareChannel } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export interface ShareableProperty {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  recommended: boolean;
}

/**
 * One-tap share flow (PRD §6.6): pick a property (recommended first), pick a
 * channel, done. Delivery goes through the message/email adapters server-side.
 */
export function SharePropertySheet({
  leadId,
  leadHasEmail,
  properties,
}: {
  leadId: string;
  leadHasEmail: boolean;
  properties: ShareableProperty[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(
    properties.find((p) => p.recommended)?.id ?? properties[0]?.id ?? null,
  );
  const [pending, startTransition] = useTransition();

  function share(channel: ShareChannel) {
    if (!selected) {
      toast.error("Pick a property first.");
      return;
    }
    startTransition(async () => {
      const result = await sharePropertyAction({ leadId, propertyId: selected, channel });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (channel === "link") {
        try {
          await navigator.clipboard.writeText(result.data.shareUrl);
          toast.success("Share link copied to clipboard");
        } catch {
          toast.success(`Share link ready: ${result.data.shareUrl}`);
        }
      } else {
        toast.success(
          result.data.dryRun
            ? `Share simulated (dry run) via ${channel}`
            : `Property sent via ${channel}`,
        );
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="lg" className="h-auto flex-col gap-1 py-2.5">
          <Share2 aria-hidden />
          <span className="text-xs">Share</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-0">
          <SheetTitle>Share a property</SheetTitle>
          <SheetDescription>
            {properties.length === 0
              ? "No available properties in inventory yet."
              : "Pick a listing, then choose how to send it."}
          </SheetDescription>
        </SheetHeader>

        {properties.length > 0 ? (
          <div className="space-y-4 p-4">
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {properties.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p.id)}
                  aria-pressed={selected === p.id}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    selected === p.id ? "border-primary bg-primary/5" : "hover:bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">{p.title}</p>
                    {p.recommended ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        <Sparkles className="size-3" aria-hidden /> Match
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.location ?? "—"} · {formatINR(p.price)}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button disabled={pending || !selected} onClick={() => share("whatsapp")}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <MessageCircle aria-hidden />}
                WhatsApp
              </Button>
              <Button variant="outline" disabled={pending || !selected} onClick={() => share("sms")}>
                <MessageSquare aria-hidden /> SMS
              </Button>
              <Button
                variant="outline"
                disabled={pending || !selected || !leadHasEmail}
                onClick={() => share("email")}
                title={leadHasEmail ? undefined : "Lead has no email on file"}
              >
                <Mail aria-hidden /> Email
              </Button>
              <Button variant="outline" disabled={pending || !selected} onClick={() => share("link")}>
                <Link2 aria-hidden /> Copy link
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
