import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";
import { InviteMemberDialog } from "@/components/team/invite-member-dialog";
import { MemberActiveToggle } from "@/components/team/member-active-toggle";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Team" };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function TeamPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "sales_manager") {
    redirect("/dashboard");
  }
  const isAdmin = profile.role === "admin";

  const supabase = await createServerSupabase();
  const { data: members, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, is_active")
    .eq("organization_id", profile.organization_id)
    .order("full_name");
  if (error) throw new Error(`Could not load the team: ${error.message}`);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Team"
        subtitle={`${members?.filter((m) => m.is_active).length ?? 0} active member${(members?.length ?? 0) === 1 ? "" : "s"}`}
        action={isAdmin ? <InviteMemberDialog /> : null}
      />

      {!members || members.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No team members yet"
          description="Invite your agents to start assigning leads."
        />
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Card key={m.id} className="flex items-center gap-3 p-3">
              <Avatar className="size-10">
                <AvatarFallback className="text-xs font-semibold">
                  {initials(m.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{m.full_name}</p>
                  {!m.is_active ? <Badge variant="secondary">Inactive</Badge> : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {ROLE_LABELS[m.role]} · {m.email}
                  {m.phone ? "" : " · no phone (bridge unavailable)"}
                </p>
              </div>
              {isAdmin && m.id !== profile.id ? (
                <MemberActiveToggle profileId={m.id} name={m.full_name} isActive={m.is_active} />
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
