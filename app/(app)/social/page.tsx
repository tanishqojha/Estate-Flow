import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { PostCard } from "@/components/social/post-card";
import { PostFormDialog } from "@/components/social/post-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireProfile } from "@/lib/db/profiles";
import { listSocialPosts, type SocialPostWithCreator } from "@/lib/db/social-posts";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SocialStatus } from "@/lib/types/database";

export const metadata: Metadata = { title: "Social Calendar" };

const TAB_ORDER: { value: SocialStatus; label: string }[] = [
  { value: "idea", label: "Ideas" },
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
];

function PostList({
  posts,
  canManage,
  emptyDescription,
}: {
  posts: SocialPostWithCreator[];
  canManage: boolean;
  emptyDescription: string;
}) {
  if (posts.length === 0) {
    return <EmptyState icon={Megaphone} title="Nothing here yet" description={emptyDescription} />;
  }
  return (
    <div className="space-y-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} canManage={canManage} />
      ))}
    </div>
  );
}

export default async function SocialPage() {
  const profile = await requireProfile();
  const allowed = ["admin", "sales_manager", "social_media_manager"].includes(profile.role);
  if (!allowed) redirect("/dashboard");

  const canManage = profile.role === "admin" || profile.role === "social_media_manager";
  const supabase = await createServerSupabase();
  const { posts, error } = await listSocialPosts(supabase, profile.organization_id);
  if (error) throw new Error(`Could not load social posts: ${error}`);

  const byStatus = (status: SocialStatus) => posts.filter((p) => p.status === status);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Social Calendar"
        subtitle={`${byStatus("scheduled").length} scheduled · ${byStatus("draft").length} drafts`}
        action={canManage ? <PostFormDialog /> : null}
      />

      <Tabs defaultValue="scheduled">
        <TabsList className="w-full">
          {TAB_ORDER.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="flex-1">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TAB_ORDER.map((t) => (
          <TabsContent key={t.value} value={t.value} className="mt-3">
            <PostList
              posts={byStatus(t.value)}
              canManage={canManage}
              emptyDescription={
                t.value === "idea"
                  ? "Capture content ideas here and promote them to drafts."
                  : t.value === "scheduled"
                    ? "Schedule drafts to see them on the calendar."
                    : t.value === "published"
                      ? "Dispatched and published posts land here."
                      : "Ideas you start writing become drafts."
              }
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
