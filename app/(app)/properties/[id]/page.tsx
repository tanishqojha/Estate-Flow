import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BedDouble, Building2, Layers, MapPin, Pencil, Ruler, Sofa } from "lucide-react";
import { AddImageDialog } from "@/components/properties/add-image-dialog";
import { AvailabilityBadge } from "@/components/properties/availability-badge";
import { DeletePropertyButton } from "@/components/properties/delete-property-button";
import { PropertyGallery } from "@/components/properties/property-gallery";
import { BackLink } from "@/components/shared/back-link";
import { CopyButton } from "@/components/shared/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProperty, getPropertyImages } from "@/lib/db/properties";
import { requireProfile } from "@/lib/db/profiles";
import { propertyShareService } from "@/lib/services/property-share-service";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatINR } from "@/lib/format";
import { FURNISHING_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Property" };

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createServerSupabase();

  const property = await getProperty(supabase, profile.organization_id, id);
  if (!property) notFound();

  const images = await getPropertyImages(supabase, property.id);
  const galleryImages = [
    ...(property.cover_image_url && !images.some((i) => i.is_cover)
      ? [{ id: "cover", url: property.cover_image_url, caption: null }]
      : []),
    ...images
      .map((img) => ({
        id: img.id,
        url: img.external_url ?? "",
        caption: img.caption,
      }))
      .filter((img) => img.url),
  ];

  const canManage = profile.role === "admin" || profile.role === "sales_manager";
  const shareUrl = propertyShareService.buildShareUrl(property.share_slug);

  const facts = [
    property.bedrooms ? { icon: BedDouble, label: `${property.bedrooms} BHK` } : null,
    property.bathrooms ? { icon: Bath, label: `${property.bathrooms} bath` } : null,
    property.size ? { icon: Ruler, label: property.size } : null,
    property.floor ? { icon: Layers, label: `Floor ${property.floor}` } : null,
    property.furnishing_status
      ? { icon: Sofa, label: FURNISHING_LABELS[property.furnishing_status] }
      : null,
  ].filter((f): f is { icon: typeof BedDouble; label: string } => f !== null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <BackLink href="/properties" label="Properties" />
        {canManage ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/properties/${property.id}/edit`}>
              <Pencil aria-hidden /> Edit
            </Link>
          </Button>
        ) : null}
      </div>

      <PropertyGallery images={galleryImages} title={property.title} />
      {canManage ? (
        <div className="flex justify-end">
          <AddImageDialog propertyId={property.id} />
        </div>
      ) : null}

      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight">{property.title}</h1>
          <AvailabilityBadge status={property.availability_status} />
        </div>
        <p className="text-lg font-semibold text-primary">{formatINR(property.price)}</p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden />
          {property.location ?? "Location on request"} ·{" "}
          {PROPERTY_TYPE_LABELS[property.property_type]}
        </p>
      </div>

      {facts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {facts.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
            >
              <Icon className="size-3.5 text-muted-foreground" aria-hidden />
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Public share link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {shareUrl}
          </p>
          <CopyButton value={shareUrl} />
        </CardContent>
      </Card>

      {property.description ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {property.description}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {property.amenities.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Amenities</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {property.amenities.map((a) => (
              <Badge key={a} variant="secondary">
                {a}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {property.address || property.owner_developer ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Internal details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            {property.address ? (
              <p className="flex items-center gap-2">
                <MapPin className="size-4" aria-hidden /> {property.address}
              </p>
            ) : null}
            {property.owner_developer ? (
              <p className="flex items-center gap-2">
                <Building2 className="size-4" aria-hidden /> {property.owner_developer}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <div className="flex justify-center pb-4">
          <DeletePropertyButton propertyId={property.id} title={property.title} />
        </div>
      ) : null}
    </div>
  );
}
