"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createPropertyAction, updatePropertyAction } from "@/app/actions/properties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AVAILABILITY_LABELS,
  FURNISHING_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/types";
import type { PropertyRow } from "@/lib/types/database";

const NONE = "none";

export function PropertyForm({ property }: { property?: PropertyRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    const amenities = String(form.get("amenities") ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    const payload = {
      title: String(form.get("title") ?? ""),
      location: String(form.get("location") ?? "") || null,
      address: String(form.get("address") ?? "") || null,
      propertyType: String(form.get("propertyType") ?? "apartment"),
      price: form.get("price") ? Number(form.get("price")) : null,
      size: String(form.get("size") ?? "") || null,
      bedrooms: form.get("bedrooms") ? Number(form.get("bedrooms")) : null,
      bathrooms: form.get("bathrooms") ? Number(form.get("bathrooms")) : null,
      floor: String(form.get("floor") ?? "") || null,
      furnishingStatus:
        form.get("furnishingStatus") && form.get("furnishingStatus") !== NONE
          ? String(form.get("furnishingStatus"))
          : null,
      availabilityStatus: String(form.get("availabilityStatus") ?? "available"),
      description: String(form.get("description") ?? "") || null,
      amenities,
      ownerDeveloper: String(form.get("ownerDeveloper") ?? "") || null,
      coverImageUrl: String(form.get("coverImageUrl") ?? "").trim() || null,
    };

    startTransition(async () => {
      const result = property
        ? await updatePropertyAction({ ...payload, id: property.id })
        : await createPropertyAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(property ? "Property updated" : "Property added");
      router.push(`/properties/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          name="title"
          defaultValue={property?.title}
          placeholder="e.g. 2BHK Apartment in Baner"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="propertyType">Type *</Label>
          <Select name="propertyType" defaultValue={property?.property_type ?? "apartment"}>
            <SelectTrigger id="propertyType" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="availabilityStatus">Availability</Label>
          <Select
            name="availabilityStatus"
            defaultValue={property?.availability_status ?? "available"}
          >
            <SelectTrigger id="availabilityStatus" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="price">Price (₹)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            inputMode="numeric"
            min={0}
            step={100000}
            defaultValue={property?.price ?? ""}
            placeholder="75,00,000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="size">Size</Label>
          <Input
            id="size"
            name="size"
            defaultValue={property?.size ?? ""}
            placeholder="1200 sq.ft"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="bedrooms">Bedrooms</Label>
          <Input
            id="bedrooms"
            name="bedrooms"
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            defaultValue={property?.bedrooms ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bathrooms">Bathrooms</Label>
          <Input
            id="bathrooms"
            name="bathrooms"
            type="number"
            inputMode="numeric"
            min={0}
            max={20}
            defaultValue={property?.bathrooms ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="floor">Floor</Label>
          <Input id="floor" name="floor" defaultValue={property?.floor ?? ""} placeholder="3 of 12" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="furnishingStatus">Furnishing</Label>
        <Select name="furnishingStatus" defaultValue={property?.furnishing_status ?? NONE}>
          <SelectTrigger id="furnishingStatus" className="w-full">
            <SelectValue placeholder="Not specified" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not specified</SelectItem>
            {Object.entries(FURNISHING_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          defaultValue={property?.location ?? ""}
          placeholder="e.g. Baner, Pune"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          name="address"
          defaultValue={property?.address ?? ""}
          placeholder="Full address (kept internal)"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="amenities">Amenities (comma separated)</Label>
        <Input
          id="amenities"
          name="amenities"
          defaultValue={property?.amenities.join(", ") ?? ""}
          placeholder="Parking, Gym, Power Backup"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ownerDeveloper">Owner / Developer</Label>
        <Input
          id="ownerDeveloper"
          name="ownerDeveloper"
          defaultValue={property?.owner_developer ?? ""}
          placeholder="e.g. Sunrise Developers"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="coverImageUrl">Cover image URL</Label>
        <Input
          id="coverImageUrl"
          name="coverImageUrl"
          type="url"
          inputMode="url"
          defaultValue={property?.cover_image_url ?? ""}
          placeholder="https://…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={property?.description ?? ""}
          placeholder="Highlights, connectivity, nearby landmarks…"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Saving…
          </>
        ) : property ? (
          "Save changes"
        ) : (
          "Add property"
        )}
      </Button>
    </form>
  );
}
