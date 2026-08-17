import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Bath, BedDouble, Building2, Layers, MapPin, Ruler, Sofa } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrganization } from "@/lib/db/organizations";
import { getPropertyByShareSlug, getPropertyImages } from "@/lib/db/properties";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatINR } from "@/lib/format";
import { FURNISHING_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/types";

export const metadata: Metadata = { title: "Property details" };
export const dynamic = "force-dynamic";

/**
 * Public property page reached via the unguessable share slug — the page a
 * lead opens from WhatsApp/SMS/email. No auth, no internal fields (address,
 * owner), read via service role scoped to exactly this slug.
 */
export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();
  if (!admin) notFound();

  const property = await getPropertyByShareSlug(admin, slug);
  if (!property) notFound();

  const [org, images] = await Promise.all([
    getOrganization(admin, property.organization_id),
    getPropertyImages(admin, property.id),
  ]);

  const gallery = [
    ...(property.cover_image_url ? [{ id: "cover", url: property.cover_image_url, caption: null as string | null }] : []),
    ...images
      .map((img) => ({ id: img.id, url: img.external_url ?? "", caption: img.caption }))
      .filter((img) => img.url && img.url !== property.cover_image_url),
  ];

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
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <header className="flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="size-4" aria-hidden />
        {org?.name ?? "EstateFlow"}
      </header>

      {gallery.length > 0 ? (
        <div className="space-y-2">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
            <Image
              src={gallery[0]!.url}
              alt={property.title}
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover"
              priority
            />
          </div>
          {gallery.length > 1 ? (
            <div className="grid grid-cols-3 gap-2">
              {gallery.slice(1, 4).map((img) => (
                <div key={img.id} className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                  <Image src={img.url} alt={img.caption ?? ""} fill sizes="33vw" className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{property.title}</h1>
        <p className="text-xl font-semibold text-primary">{formatINR(property.price)}</p>
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

      {property.description ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">About this property</CardTitle>
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

      <footer className="pb-6 pt-2 text-center text-xs text-muted-foreground">
        Shared by {org?.name ?? "your agent"} · Reply to the message you received to know more.
      </footer>
    </main>
  );
}
