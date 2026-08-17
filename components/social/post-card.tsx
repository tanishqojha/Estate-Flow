import { format } from "date-fns";
import { CalendarClock, UserRound } from "lucide-react";
import { DispatchPostButton, DeletePostButton } from "@/components/social/post-actions";
import { PostFormDialog } from "@/components/social/post-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { SocialPostWithCreator } from "@/lib/db/social-posts";
import { SOCIAL_POST_TYPE_LABELS, SOCIAL_STATUS_LABELS } from "@/lib/types";
import type { SocialStatus } from "@/lib/types/database";

const STATUS_VARIANT: Record<SocialStatus, "secondary" | "outline" | "warning" | "success"> = {
  idea: "outline",
  draft: "secondary",
  scheduled: "warning",
  published: "success",
};

export function PostCard({
  post,
  canManage,
}: {
  post: SocialPostWithCreator;
  canManage: boolean;
}) {
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{post.title}</p>
          <p className="text-xs text-muted-foreground">
            {SOCIAL_POST_TYPE_LABELS[post.post_type]}
            {post.platforms.length > 0 ? ` · ${post.platforms.join(", ")}` : ""}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[post.status]}>{SOCIAL_STATUS_LABELS[post.status]}</Badge>
      </div>

      {post.caption ? (
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
          {post.caption}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {post.scheduled_for ? (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3" aria-hidden />
            {format(new Date(post.scheduled_for), "d MMM, p")}
          </span>
        ) : null}
        {post.creator ? (
          <span className="inline-flex items-center gap-1">
            <UserRound className="size-3" aria-hidden />
            {post.creator.full_name}
          </span>
        ) : null}
      </div>

      {canManage ? (
        <div className="flex items-center justify-end gap-1 border-t pt-2">
          {post.status !== "published" ? <DispatchPostButton postId={post.id} /> : null}
          <PostFormDialog post={post} />
          <DeletePostButton postId={post.id} title={post.title} />
        </div>
      ) : null}
    </Card>
  );
}
