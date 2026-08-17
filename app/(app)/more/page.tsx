import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  ChevronRight,
  Megaphone,
  Plug,
  Settings,
  UsersRound,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/db/profiles";
import { ROLE_LABELS } from "@/lib/types";
import type { UserRole } from "@/lib/types/database";

export const metadata: Metadata = { title: "More" };

interface MenuItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: UserRole[] | "all";
}

const MENU: MenuItem[] = [
  {
    href: "/attendance",
    label: "Attendance",
    description: "GPS check-in / check-out",
    icon: MapPin,
    roles: "all",
  },
  {
    href: "/social",
    label: "Social Calendar",
    description: "Drafts, schedule, dispatch",
    icon: Megaphone,
    roles: ["admin", "sales_manager", "social_media_manager"],
  },
  {
    href: "/team",
    label: "Team",
    description: "Members, roles, invites",
    icon: UsersRound,
    roles: ["admin", "sales_manager"],
  },
  {
    href: "/reports",
    label: "Reports",
    description: "Sources, pipeline, calls, attendance",
    icon: BarChart3,
    roles: ["admin", "sales_manager"],
  },
  {
    href: "/notifications",
    label: "Notifications",
    description: "Everything that needs your attention",
    icon: Bell,
    roles: "all",
  },
  {
    href: "/settings",
    label: "Settings",
    description: "Organization preferences",
    icon: Settings,
    roles: ["admin"],
  },
  {
    href: "/settings/integrations",
    label: "Integrations",
    description: "Twilio, WhatsApp, email, webhooks",
    icon: Plug,
    roles: ["admin"],
  },
];

export default async function MorePage() {
  const profile = await requireProfile();
  const items = MENU.filter(
    (m) => m.roles === "all" || m.roles.includes(profile.role),
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="More"
        subtitle={`${profile.full_name} · ${ROLE_LABELS[profile.role]}`}
      />

      <div className="space-y-2">
        {items.map(({ href, label, description, icon: Icon }) => (
          <Card
            key={href}
            className="p-0 transition-[transform,border-color] has-[a:hover]:border-ring/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <Link
              href={href}
              className="group flex min-h-16 items-center gap-3 px-4 py-3 outline-none"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {description}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden />
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
