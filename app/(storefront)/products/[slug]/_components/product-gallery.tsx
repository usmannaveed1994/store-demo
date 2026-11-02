"use client";

import Image from "next/image";
import { useState } from "react";

import { isRemoteUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

type GalleryImage = {
  url: string;
  alt: string | null;
};

type ProductGalleryProps = {
  images: GalleryImage[];
  /** Used for the initials placeholder when a product has no photo at all. */
  title: string;
};

/**
 * Product photos with a thumbnail strip.
 *
 * Client-side because selecting an image is local UI state: the alt text stays
 * empty and the heading beside the gallery names the product, so nothing here
 * needs the server.
 */
export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex];

  if (!activeImage) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
        <div className="flex size-full items-center justify-center bg-linear-to-br from-muted to-muted-foreground/10">
          <span aria-hidden className="text-5xl font-semibold tracking-tight text-muted-foreground/60">
            {title.slice(0, 2).toUpperCase()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
        <Image
          key={activeImage.url}
          alt=""
          src={activeImage.url}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          unoptimized={isRemoteUrl(activeImage.url)}
          className="object-cover"
        />
      </div>

      {images.length > 1 ? (
        <ul className="grid grid-cols-5 gap-3">
          {images.map((image, index) => (
            <li key={image.url}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-lg border bg-muted transition-colors",
                  index === activeIndex
                    ? "border-foreground"
                    : "border-border hover:border-foreground/40",
                )}
              >
                <Image
                  alt=""
                  src={image.url}
                  fill
                  sizes="120px"
                  unoptimized={isRemoteUrl(image.url)}
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
