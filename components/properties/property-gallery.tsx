"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GalleryImage {
  id: string;
  url: string;
  caption: string | null;
}

/** Swipe-friendly gallery: large view + thumbnail strip. */
export function PropertyGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-xl border border-dashed bg-muted">
        <Building2 className="size-10 text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
        {current ? (
          <Image
            src={current.url}
            alt={current.caption ?? title}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
            priority
          />
        ) : null}
      </div>
      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === active}
              className={cn(
                "relative aspect-video w-20 shrink-0 overflow-hidden rounded-md border-2",
                i === active ? "border-primary" : "border-transparent opacity-70",
              )}
            >
              <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
      {current?.caption ? (
        <p className="text-xs text-muted-foreground">{current.caption}</p>
      ) : null}
    </div>
  );
}
