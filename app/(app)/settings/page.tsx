import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Plug } from "lucide-react";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrganization } from "@/lib/db/organizations";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard");

  const supabase = await createServerSupabase();
  const org = await getOrganization(supabase, profile.organization_id);
  if (!org) notFound();

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Organization preferences" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <OrgSettingsForm org={org} />
        </CardContent>
      </Card>

      <Card className="p-0 transition-[transform,border-color] has-[a:hover]:border-ring/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100">
        <Link
          href="/settings/integrations"
          className="group flex min-h-16 items-center gap-3 px-4 py-3 outline-none"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
            <Plug className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Integrations</span>
            <span className="block text-sm text-muted-foreground">
              Twilio, WhatsApp, email, AI, webhooks
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden />
        </Link>
      </Card>
    </div>
  );
}
