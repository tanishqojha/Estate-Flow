"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSocialPostAction, dispatchSocialPostAction } from "@/app/actions/social";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DispatchPostButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await dispatchSocialPostAction({ id: postId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(
            result.dryRun ? "Dispatch simulated (dry run)" : "Post sent to your automation webhook",
          );
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
      Dispatch
    </Button>
  );
}

export function DeletePostButton({ postId, title }: { postId: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:text-destructive"
          aria-label={`Delete ${title}`}
        >
          <Trash2 aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The post and its caption are removed from the calendar. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const result = await deleteSocialPostAction({ id: postId });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Post deleted");
                router.refresh();
              });
            }}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
