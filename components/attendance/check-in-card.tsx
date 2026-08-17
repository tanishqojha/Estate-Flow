"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Camera, Loader2, LogIn, LogOut, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { checkInAction, checkOutAction } from "@/app/actions/attendance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttendanceRow } from "@/lib/types/database";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location is not supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      reject(
        new Error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — allow it in your browser settings."
            : "Could not get your location. Move to an open area and retry.",
        ),
      );
    }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 });
  });
}

export function CheckInCard({ today }: { today: AttendanceRow | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [selfie, setSelfie] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const checkedIn = !!today?.check_in_time;
  const checkedOut = !!today?.check_out_time;
  const busy = pending || locating;

  async function run(kind: "in" | "out") {
    setLocating(true);
    let position: GeolocationPosition;
    try {
      position = await getPosition();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Location unavailable");
      setLocating(false);
      return;
    }
    setLocating(false);

    const form = new FormData();
    form.set("lat", String(position.coords.latitude));
    form.set("lng", String(position.coords.longitude));
    if (kind === "in" && selfie) form.set("selfie", selfie);

    startTransition(async () => {
      const result = kind === "in" ? await checkInAction(form) : await checkOutAction(form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(kind === "in" ? "Checked in — have a great day!" : "Checked out. See you!");
      setSelfie(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Today</CardTitle>
        {checkedIn ? (
          <Badge variant={today?.status === "late" ? "warning" : "success"}>
            {today?.status === "late" ? "Late" : "Present"}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Check-in</p>
            <p className="text-lg font-semibold">
              {today?.check_in_time ? format(new Date(today.check_in_time), "p") : "—"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Check-out</p>
            <p className="text-lg font-semibold">
              {today?.check_out_time ? format(new Date(today.check_out_time), "p") : "—"}
            </p>
          </div>
        </div>

        {!checkedIn ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="user"
              className="sr-only"
              aria-label="Take a selfie"
              onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                <Camera aria-hidden /> {selfie ? "Retake selfie" : "Add selfie (optional)"}
              </Button>
              {selfie ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {selfie.name.slice(0, 18)}
                  <button
                    type="button"
                    aria-label="Remove selfie"
                    onClick={() => setSelfie(null)}
                    className="text-destructive"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </span>
              ) : null}
            </div>
            <Button size="lg" className="w-full" disabled={busy} onClick={() => run("in")}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <LogIn aria-hidden />}
              {locating ? "Getting location…" : "Check in"}
            </Button>
          </>
        ) : !checkedOut ? (
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => run("out")}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
            {locating ? "Getting location…" : "Check out"}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">Day complete ✅</p>
        )}

        <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
          <MapPin className="size-3" aria-hidden />
          Location is captured only at check-in and check-out.
        </p>
      </CardContent>
    </Card>
  );
}
