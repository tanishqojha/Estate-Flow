"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Loader2, Pencil, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  createSocialPostAction,
  generateCaptionAction,
  updateSocialPostAction,
} from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SOCIAL_POST_TYPE_LABELS, SOCIAL_STATUS_LABELS } from "@/lib/types";
import type { SocialPostRow } from "@/lib/types/database";
import { PLATFORM_OPTIONS } from "@/lib/validation/social";
import { cn } from "@/lib/utils";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  x: "X",
};

export function PostFormDialog({ post }: { post?: SocialPostRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [aiPending, startAiTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(post?.title ?? "");
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [postType, setPostType] = useState<string>(post?.post_type ?? "image");
  const [status, setStatus] = useState<string>(post?.status ?? "idea");
  const [scheduledFor, setScheduledFor] = useState<string>(
    post?.scheduled_for ? format(new Date(post.scheduled_for), "yyyy-MM-dd'T'HH:mm") : "",
  );
  const [platforms, setPlatforms] = useState<string[]>(post?.platforms ?? ["instagram"]);

  function togglePlatform(p: string) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  function handleGenerateCaption() {
    if (title.trim().length < 3) {
      toast.error("Add a title first — the AI uses it as the brief.");
      return;
    }
    startAiTransition(async () => {
      const result = await generateCaptionAction({
        title,
        postType,
        platforms,
        extraContext: caption || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCaption(result.data.caption);
      toast.success(result.dryRun ? "Template caption added (AI key not set)" : "Caption generated");
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const payload = {
      title,
      caption: caption || null,
      postType,
      status,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      platforms,
    };
    startTransition(async () => {
      const result = post
        ? await updateSocialPostAction({ ...payload, id: post.id })
        : await createSocialPostAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(post ? "Post updated" : "Post created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {post ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${post.title}`}>
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> New post
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{post ? "Edit post" : "New post"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New launch teaser — Baner"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="postType">Format</Label>
              <Select value={postType} onValueChange={setPostType}>
                <SelectTrigger id="postType" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOCIAL_POST_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SOCIAL_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  aria-pressed={platforms.includes(p)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    platforms.includes(p)
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduledFor">Schedule for</Label>
            <Input
              id="scheduledFor"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="caption">Caption</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateCaption}
                disabled={aiPending}
              >
                {aiPending ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Sparkles aria-hidden />
                )}
                AI caption
              </Button>
            </div>
            <Textarea
              id="caption"
              rows={5}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write it yourself or tap AI caption…"
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {post ? "Save changes" : "Create post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
