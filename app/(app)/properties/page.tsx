import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { PropertyCard } from "@/components/properties/property-card";
import { PropertyFilters } from "@/components/properties/property-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { PROPERTIES_PAGE_SIZE, listProperties } from "@/lib/db/properties";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";
import { propertyFiltersSchema } from "@/lib/validation/property";

export const metadata: Metadata = { title: "Properties" };

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = propertyFiltersSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    type: typeof raw.type === "string" ? raw.type : undefined,
    availability: typeof raw.availability === "string" ? raw.availability : undefined,
    page: typeof raw.page === "string" ? raw.page : undefined,
  });
  const filters = parsed.success ? parsed.data : propertyFiltersSchema.parse({});

  const profile = await requireProfile();
  const supabase = await createServerSupabase();
  const canManage = profile.role === "admin" || profile.role === "sales_manager";

  const { properties, total, error } = await listProperties(
    supabase,
    profile.organization_id,
    filters,
  );
  if (error) throw new Error(`Could not load properties: ${error}`);

  const totalPages = Math.max(1, Math.ceil(total / PROPERTIES_PAGE_SIZE));
  const hasFilters = !!(filters.q || filters.type || filters.availability);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Properties"
        subtitle={`${total} ${total === 1 ? "listing" : "listings"}`}
        action={
          canManage ? (
            <Button asChild>
              <Link href="/properties/new">
                <Plus aria-hidden /> Add
              </Link>
            </Button>
          ) : null
        }
      />

      <PropertyFilters />

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={hasFilters ? "No properties match these filters" : "No properties yet"}
          description={
            hasFilters
              ? "Try widening or clearing the filters."
              : canManage
                ? "Add your first listing to start sharing with leads."
                : "Listings added by your team will appear here."
          }
          action={
            !hasFilters && canManage ? (
              <Button asChild variant="outline">
                <Link href="/properties/new">
                  <Plus aria-hidden /> Add property
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>

          {filters.page < totalPages ? (
            <div className="flex justify-center pt-2">
              <Button asChild variant="outline">
                <Link
                  href={`/properties?${new URLSearchParams({
                    ...(filters.q ? { q: filters.q } : {}),
                    ...(filters.type ? { type: filters.type } : {}),
                    ...(filters.availability ? { availability: filters.availability } : {}),
                    page: String(filters.page + 1),
                  }).toString()}`}
                >
                  Load more
                </Link>
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
