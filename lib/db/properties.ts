import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  LeadRow,
  PropertyImageRow,
  PropertyRow,
} from "@/lib/types/database";
import type { PropertyFilters } from "@/lib/validation/property";

type Db = SupabaseClient<Database>;

export const PROPERTIES_PAGE_SIZE = 20;

export async function listProperties(
  db: Db,
  organizationId: string,
  filters: PropertyFilters,
): Promise<{ properties: PropertyRow[]; total: number; error: string | null }> {
  let query = db
    .from("properties")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);

  if (filters.q) {
    const q = filters.q.replace(/[%_,]/g, " ").trim();
    if (q) query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%,address.ilike.%${q}%`);
  }
  if (filters.type) query = query.eq("property_type", filters.type);
  if (filters.availability) query = query.eq("availability_status", filters.availability);

  const from = (filters.page - 1) * PROPERTIES_PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PROPERTIES_PAGE_SIZE - 1);

  if (error) {
    console.error("listProperties failed:", error.message);
    return { properties: [], total: 0, error: error.message };
  }
  return { properties: data ?? [], total: count ?? 0, error: null };
}

export async function getProperty(
  db: Db,
  organizationId: string,
  propertyId: string,
): Promise<PropertyRow | null> {
  const { data, error } = await db
    .from("properties")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", propertyId)
    .maybeSingle();
  if (error) {
    console.error("getProperty failed:", error.message);
    return null;
  }
  return data;
}

export async function getPropertyImages(
  db: Db,
  propertyId: string,
): Promise<PropertyImageRow[]> {
  const { data, error } = await db
    .from("property_images")
    .select("*")
    .eq("property_id", propertyId)
    .order("sort_order");
  if (error) {
    console.error("getPropertyImages failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function insertProperty(
  db: Db,
  values: Database["public"]["Tables"]["properties"]["Insert"],
): Promise<{ property: PropertyRow | null; error: string | null }> {
  const { data, error } = await db.from("properties").insert(values).select().single();
  if (error) {
    console.error("insertProperty failed:", error.message);
    return { property: null, error: error.message };
  }
  return { property: data, error: null };
}

export async function updateProperty(
  db: Db,
  organizationId: string,
  propertyId: string,
  values: Database["public"]["Tables"]["properties"]["Update"],
): Promise<{ property: PropertyRow | null; error: string | null }> {
  const { data, error } = await db
    .from("properties")
    .update(values)
    .eq("organization_id", organizationId)
    .eq("id", propertyId)
    .select()
    .single();
  if (error) {
    console.error("updateProperty failed:", error.message);
    return { property: null, error: error.message };
  }
  return { property: data, error: null };
}

export async function deleteProperty(
  db: Db,
  organizationId: string,
  propertyId: string,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from("properties")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", propertyId);
  if (error) {
    console.error("deleteProperty failed:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

export async function addPropertyImage(
  db: Db,
  values: Database["public"]["Tables"]["property_images"]["Insert"],
): Promise<{ error: string | null }> {
  const { error } = await db.from("property_images").insert(values);
  if (error) {
    console.error("addPropertyImage failed:", error.message);
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Inventory matching (PRD §6.8): same property type when known, price within
 * a widened budget window, location text match when set. Sold/Rented are
 * always excluded. Loosest surviving filter set wins — a lead with no
 * criteria still gets fresh available inventory.
 */
export async function getMatchingProperties(
  db: Db,
  organizationId: string,
  lead: Pick<
    LeadRow,
    "property_type" | "budget_min" | "budget_max" | "preferred_location"
  >,
  limit = 5,
): Promise<PropertyRow[]> {
  let query = db
    .from("properties")
    .select("*")
    .eq("organization_id", organizationId)
    .in("availability_status", ["available", "hold"]);

  if (lead.property_type) query = query.eq("property_type", lead.property_type);
  // Widen the window 20% both ways — budgets are aspirations, not contracts.
  if (lead.budget_max) query = query.lte("price", lead.budget_max * 1.2);
  if (lead.budget_min) query = query.gte("price", lead.budget_min * 0.8);
  if (lead.preferred_location) {
    const loc = lead.preferred_location.replace(/[%_,]/g, " ").trim();
    if (loc) query = query.ilike("location", `%${loc}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) {
    console.error("getMatchingProperties failed:", error.message);
    return [];
  }
  return data ?? [];
}

/** Public share-link lookup — service-role only, unguessable slug. */
export async function getPropertyByShareSlug(
  db: Db,
  slug: string,
): Promise<PropertyRow | null> {
  if (!slug || slug.length < 8) return null;
  const { data, error } = await db
    .from("properties")
    .select("*")
    .eq("share_slug", slug)
    .maybeSingle();
  if (error) {
    console.error("getPropertyByShareSlug failed:", error.message);
    return null;
  }
  return data;
}
