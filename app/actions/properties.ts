"use server";

import { revalidatePath } from "next/cache";
import {
  addPropertyImage,
  deleteProperty as dbDeleteProperty,
  insertProperty,
  updateProperty as dbUpdateProperty,
} from "@/lib/db/properties";
import { requireProfile } from "@/lib/db/profiles";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import {
  addPropertyImageSchema,
  createPropertySchema,
  deletePropertySchema,
  updatePropertySchema,
} from "@/lib/validation/property";

function canManageInventory(role: string): boolean {
  return role === "admin" || role === "sales_manager";
}

export async function createPropertyAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createPropertySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  try {
    const profile = await requireProfile();
    if (!canManageInventory(profile.role)) {
      return { ok: false, error: "Only admins and managers can add properties." };
    }
    const supabase = await createServerSupabase();

    const { property, error } = await insertProperty(supabase, {
      organization_id: profile.organization_id,
      title: input.title,
      location: input.location || null,
      address: input.address || null,
      property_type: input.propertyType,
      price: input.price ?? null,
      size: input.size || null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      floor: input.floor || null,
      furnishing_status: input.furnishingStatus ?? null,
      availability_status: input.availabilityStatus,
      description: input.description || null,
      amenities: input.amenities,
      owner_developer: input.ownerDeveloper || null,
      cover_image_url: input.coverImageUrl ?? null,
    });
    if (error || !property) return { ok: false, error: error ?? "Could not create property" };

    revalidatePath("/properties");
    return { ok: true, data: { id: property.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not create property" };
  }
}

export async function updatePropertyAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = updatePropertySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { id, ...input } = parsed.data;

  try {
    const profile = await requireProfile();
    if (!canManageInventory(profile.role)) {
      return { ok: false, error: "Only admins and managers can edit properties." };
    }
    const supabase = await createServerSupabase();

    const values: Record<string, unknown> = {};
    if (input.title !== undefined) values.title = input.title;
    if (input.location !== undefined) values.location = input.location || null;
    if (input.address !== undefined) values.address = input.address || null;
    if (input.propertyType !== undefined) values.property_type = input.propertyType;
    if (input.price !== undefined) values.price = input.price;
    if (input.size !== undefined) values.size = input.size || null;
    if (input.bedrooms !== undefined) values.bedrooms = input.bedrooms;
    if (input.bathrooms !== undefined) values.bathrooms = input.bathrooms;
    if (input.floor !== undefined) values.floor = input.floor || null;
    if (input.furnishingStatus !== undefined) values.furnishing_status = input.furnishingStatus;
    if (input.availabilityStatus !== undefined)
      values.availability_status = input.availabilityStatus;
    if (input.description !== undefined) values.description = input.description || null;
    if (input.amenities !== undefined) values.amenities = input.amenities;
    if (input.ownerDeveloper !== undefined) values.owner_developer = input.ownerDeveloper || null;
    if (input.coverImageUrl !== undefined) values.cover_image_url = input.coverImageUrl;

    const { property, error } = await dbUpdateProperty(
      supabase,
      profile.organization_id,
      id,
      values,
    );
    if (error || !property) return { ok: false, error: error ?? "Could not update property" };

    revalidatePath("/properties");
    revalidatePath(`/properties/${id}`);
    return { ok: true, data: { id: property.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not update property" };
  }
}

export async function deletePropertyAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = deletePropertySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const profile = await requireProfile();
    if (!canManageInventory(profile.role)) {
      return { ok: false, error: "Only admins and managers can delete properties." };
    }
    const supabase = await createServerSupabase();

    const { error } = await dbDeleteProperty(supabase, profile.organization_id, parsed.data.id);
    if (error) return { ok: false, error };

    revalidatePath("/properties");
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not delete property" };
  }
}

export async function addPropertyImageAction(raw: unknown): Promise<ActionResult<undefined>> {
  const parsed = addPropertyImageSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const profile = await requireProfile();
    if (!canManageInventory(profile.role)) {
      return { ok: false, error: "Only admins and managers can add images." };
    }
    const supabase = await createServerSupabase();

    const { error } = await addPropertyImage(supabase, {
      organization_id: profile.organization_id,
      property_id: parsed.data.propertyId,
      external_url: parsed.data.externalUrl,
      caption: parsed.data.caption ?? null,
    });
    if (error) return { ok: false, error };

    revalidatePath(`/properties/${parsed.data.propertyId}`);
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not add image" };
  }
}
