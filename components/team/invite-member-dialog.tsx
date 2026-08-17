"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteMemberAction } from "@/app/actions/team";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { ROLE_LABELS } from "@/lib/types";

export function InviteMemberDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setError(null);
    setResult(null);
    setCopied(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        {result ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Member added</DialogTitle>
              <DialogDescription>
                Share these credentials securely — this password is shown only once.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Email: </span>
                {result.email}
              </p>
              <p className="font-mono">
                <span className="font-sans text-muted-foreground">Temp password: </span>
                {result.tempPassword}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `EstateFlow login\nEmail: ${result.email}\nPassword: ${result.tempPassword}`,
                    );
                    setCopied(true);
                  } catch {
                    toast.error("Could not copy.");
                  }
                }}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                Copy credentials
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const form = new FormData(e.currentTarget);
              const email = String(form.get("email") ?? "");
              startTransition(async () => {
                const res = await inviteMemberAction({
                  email,
                  fullName: String(form.get("fullName") ?? ""),
                  phone: String(form.get("phone") ?? ""),
                  role: String(form.get("role") ?? "sales_agent"),
                });
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setResult({ email, tempPassword: res.data.tempPassword });
                router.refresh();
              });
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Invite a team member</DialogTitle>
              <DialogDescription>
                They&apos;ll get access to this workspace with the role you pick.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full name *</Label>
              <Input id="fullName" name="fullName" required placeholder="e.g. Rahul Verma" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required placeholder="name@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (needed for the call bridge)</Label>
              <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="+91 98765 43210" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select name="role" defaultValue="sales_agent">
                <SelectTrigger id="role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
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

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Add member
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
