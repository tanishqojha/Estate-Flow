"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addPropertyImageAction } from "@/app/actions/properties";
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

export function AddImageDialog({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ImagePlus aria-hidden /> Add image
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const form = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await addPropertyImageAction({
                propertyId,
                externalUrl: String(form.get("url") ?? ""),
                caption: String(form.get("caption") ?? "") || null,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              toast.success("Image added");
              setOpen(false);
              router.refresh();
            });
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>Add image</DialogTitle>
            <DialogDescription>
              Paste an image URL. Direct uploads to Supabase Storage use the same gallery.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="url">Image URL *</Label>
            <Input id="url" name="url" type="url" inputMode="url" placeholder="https://…" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Input id="caption" name="caption" placeholder="e.g. Living room" />
          </div>
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Add image
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
