import Link from "next/link";
import { Building2, PhoneCall, Users, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const highlights = [
  {
    icon: PhoneCall,
    title: "Instant call bridge",
    description: "New lead → agent's phone rings in seconds → live bridge.",
  },
  {
    icon: Users,
    title: "Lead timelines",
    description: "Every call, note, share and follow-up in one auditable feed.",
  },
  {
    icon: Building2,
    title: "One-tap sharing",
    description: "Send property details via WhatsApp, SMS or email in one tap.",
  },
  {
    icon: CalendarClock,
    title: "Follow-ups that happen",
    description: "Scheduled reminders so no lead goes cold.",
  },
] as const;

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight">EstateFlow CRM</h1>
        <p className="text-muted-foreground">
          The phone-first sales OS for real estate teams. Speed-to-lead,
          measured in seconds.
        </p>
      </div>

      <div className="grid gap-3">
        {highlights.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader className="flex-row items-center gap-3 space-y-0 pb-2">
              <Icon className="size-5 text-primary" aria-hidden />
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button asChild size="lg" className="w-full">
        <Link href="/login">Sign in</Link>
      </Button>
    </main>
  );
}
