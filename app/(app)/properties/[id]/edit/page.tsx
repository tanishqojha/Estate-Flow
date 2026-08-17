import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PropertyForm } from "@/components/properties/property-form";
import { BackLink } from "@/components/shared/back-link";
import { getProperty } from "@/lib/db/properties";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit property" };

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "sales_manager") {
    redirect(`/properties/${id}`);
  }

  const supabase = await createServerSupabase();
  const property = await getProperty(supabase, profile.organization_id, id);
  if (!property) notFound();

  return (
    <div className="space-y-4">
      <BackLink href={`/properties/${property.id}`} label={property.title} />
      <h1 className="text-xl font-bold tracking-tight">Edit property</h1>
      <PropertyForm property={property} />
    </div>
  );
}
