import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { getCurrentProfile } from "@/lib/db/profiles";
import { getOrganization } from "@/lib/db/organizations";
import { getUnreadNotificationCount } from "@/lib/db/notifications";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Authenticated app shell: sticky header + scrollable content + bottom nav.
 * Auth is enforced here (second line after middleware); RLS is the real wall.
 * Everything under (app) is per-user — never statically prerendered.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createServerSupabase();
  const [org, unreadCount] = await Promise.all([
    getOrganization(supabase, profile.organization_id),
    getUnreadNotificationCount(supabase, profile.id),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <AppHeader
        profile={profile}
        orgName={org?.name ?? "EstateFlow"}
        unreadCount={unreadCount}
      />
      <main id="main-content" className="flex-1 px-4 pb-24 pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
