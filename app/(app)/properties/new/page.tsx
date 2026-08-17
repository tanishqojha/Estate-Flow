import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PropertyForm } from "@/components/properties/property-form";
import { BackLink } from "@/components/shared/back-link";
import { requireProfile } from "@/lib/db/profiles";

export const metadata: Metadata = { title: "Add property" };

export default async function NewPropertyPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "sales_manager") {
    redirect("/properties");
  }

  return (
    <div className="space-y-4">
      <BackLink href="/properties" label="Properties" />
      <h1 className="text-xl font-bold tracking-tight">Add property</h1>
      <PropertyForm />
    </div>
  );
}
