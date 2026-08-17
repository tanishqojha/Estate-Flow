"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setMemberActiveAction } from "@/app/actions/team";
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

export function MemberActiveToggle({
  profileId,
  name,
  isActive,
}: {
  profileId: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply() {
    startTransition(async () => {
      const result = await setMemberActiveAction({ profileId }, !isActive);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isActive ? "Member deactivated" : "Member reactivated");
      router.refresh();
    });
  }

  if (!isActive) {
    return (
      <Button variant="outline" size="sm" disabled={pending} onClick={apply}>
        Reactivate
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          Deactivate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access immediately and stop receiving lead assignments. Their history stays
            intact. You can reactivate them anytime.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              apply();
            }}
          >
            {pending ? "Deactivating…" : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
