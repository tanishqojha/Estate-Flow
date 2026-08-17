import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Building2, MapPin, Ruler } from "lucide-react";
import { AvailabilityBadge } from "@/components/properties/availability-badge";
import { Card } from "@/components/ui/card";
import { formatINR } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/types";
import type { PropertyRow } from "@/lib/types/database";

export function PropertyCard({ property }: { property: PropertyRow }) {
  return (
    <Card className="overflow-hidden p-0 transition-[transform,border-color] has-[a:hover]:border-ring/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100">
      <Link href={`/properties/${property.id}`} className="group block outline-none">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {property.cover_image_url ? (
            <Image
              src={property.cover_image_url}
              alt={property.title}
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Building2 className="size-10 text-muted-foreground" aria-hidden />
            </div>
          )}
          <div className="absolute left-2 top-2">
            <AvailabilityBadge status={property.availability_status} />
          </div>
        </div>
        <div className="space-y-1.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate font-semibold">{property.title}</p>
            <p className="shrink-0 font-semibold text-primary">{formatINR(property.price)}</p>
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" aria-hidden />
            {property.location ?? "Location on request"} ·{" "}
            {PROPERTY_TYPE_LABELS[property.property_type]}
          </p>
          <div className="flex gap-3 text-xs text-muted-foreground">
            {property.bedrooms ? (
              <span className="inline-flex items-center gap-1">
                <BedDouble className="size-3" aria-hidden /> {property.bedrooms} BHK
              </span>
            ) : null}
            {property.bathrooms ? (
              <span className="inline-flex items-center gap-1">
                <Bath className="size-3" aria-hidden /> {property.bathrooms}
              </span>
            ) : null}
            {property.size ? (
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-3" aria-hidden /> {property.size}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </Card>
  );
}
