"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateOrgSettingsAction } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ASSIGNMENT_MODE_LABELS } from "@/lib/types";
import type { OrganizationRow } from "@/lib/types/database";

export function OrgSettingsForm({ org }: { org: OrganizationRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const form = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await updateOrgSettingsAction({
            name: String(form.get("name") ?? ""),
            timezone: String(form.get("timezone") ?? ""),
            defaultAssignmentMode: String(form.get("assignmentMode") ?? "round_robin"),
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          toast.success("Settings saved");
          router.refresh();
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Organization name *</Label>
        <Input id="name" name="name" defaultValue={org.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Input
          id="timezone"
          name="timezone"
          defaultValue={org.timezone}
          placeholder="Asia/Kolkata"
        />
        <p className="text-xs text-muted-foreground">
          IANA name — used for attendance late-marking.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="assignmentMode">Default lead assignment</Label>
        <Select name="assignmentMode" defaultValue={org.default_assignment_mode}>
          <SelectTrigger id="assignmentMode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ASSIGNMENT_MODE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Save settings
      </Button>
    </form>
  );
}
