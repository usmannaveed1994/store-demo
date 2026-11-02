"use client";

import Image from "next/image";
import { useState, type ChangeEvent } from "react";
import { upload } from "@vercel/blob/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isRemoteUrl } from "@/lib/images";
import {
  IMAGE_ACCEPT_ATTRIBUTE,
  MAX_GALLERY_IMAGES,
  MAX_IMAGE_SIZE_IN_BYTES,
} from "@/lib/products/constants";

type ProductImageFieldProps = {
  initialImages: string[];
  error?: string;
};

const MAX_IMAGE_SIZE_IN_MEGABYTES = Math.round(MAX_IMAGE_SIZE_IN_BYTES / (1024 * 1024));

/**
 * Gallery editor.
 *
 * Files go from the browser straight to Vercel Blob with a short-lived token
 * from `/api/admin/uploads`; only the resulting URLs travel with the form. The
 * order of the list is the gallery order, which is why every row renders a
 * hidden `imageUrl` input in sequence.
 */
export function ProductImageField({ initialImages, error }: ProductImageFieldProps) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isFull = images.length >= MAX_GALLERY_IMAGES;

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Reset so picking the same file twice still fires a change event.
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const room = MAX_GALLERY_IMAGES - images.length;
      const uploaded: string[] = [];

      for (const file of files.slice(0, room)) {
        if (file.size > MAX_IMAGE_SIZE_IN_BYTES) {
          throw new Error(`${file.name} is larger than ${MAX_IMAGE_SIZE_IN_MEGABYTES} MB.`);
        }

        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/admin/uploads",
          contentType: file.type,
        });

        uploaded.push(blob.url);
      }

      setImages((current) => [...current, ...uploaded].slice(0, MAX_GALLERY_IMAGES));
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "Upload failed. Try again.");
    } finally {
      setIsUploading(false);
    }
  }

  function removeImage(url: string) {
    setImages((current) => current.filter((value) => value !== url));
  }

  return (
    <div className="flex flex-col gap-4">
      {images.map((url) => (
        <input key={url} type="hidden" name="imageUrl" value={url} />
      ))}

      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((url, index) => (
            <li key={url} className="flex flex-col gap-2 rounded-lg border border-border p-2">
              <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-cover"
                  unoptimized={isRemoteUrl(url)}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {index === 0 ? "Thumbnail" : `Image ${index + 1}`}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeImage(url)}
                  aria-label={`Remove image ${index + 1}`}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No images yet. The first image becomes the catalogue thumbnail.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Input
          type="file"
          accept={IMAGE_ACCEPT_ATTRIBUTE}
          multiple
          disabled={isFull || isUploading}
          onChange={handleFiles}
          aria-invalid={Boolean(error) || Boolean(uploadError)}
          className="h-auto cursor-pointer py-2 file:mr-3"
        />
        <p className="text-xs text-muted-foreground">
          {isFull
            ? `Gallery full (${MAX_GALLERY_IMAGES} images). Remove one to add another.`
            : `Up to ${MAX_GALLERY_IMAGES} images, ${MAX_IMAGE_SIZE_IN_MEGABYTES} MB each.`}
          {isUploading ? " Uploading…" : ""}
        </p>
        {uploadError ? (
          <p role="alert" className="text-xs text-destructive">
            {uploadError}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
