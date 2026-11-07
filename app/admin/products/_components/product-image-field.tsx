"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { upload } from "@vercel/blob/client";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

import { Input } from "@/components/ui/input";
import {
  ALLOWED_IMAGE_TYPES,
  IMAGE_ACCEPT_ATTRIBUTE,
  MAX_CROP_SOURCE_SIZE_IN_BYTES,
  MAX_GALLERY_IMAGES,
  MAX_IMAGE_SIZE_IN_BYTES,
} from "@/lib/products/constants";

import { ImageCropDialog } from "./image-crop-dialog";
import { SortableImageCard } from "./sortable-image-card";

type ProductImageFieldProps = {
  initialImages: string[];
  error?: string;
};

type QueuedFile = {
  id: string;
  file: File;
  /** Object URL for the crop preview; revoked as soon as the file leaves the queue. */
  previewUrl: string;
};

const ALLOWED_TYPES = new Set<string>(ALLOWED_IMAGE_TYPES);
const MAX_IMAGE_SIZE_IN_MEGABYTES = Math.round(MAX_IMAGE_SIZE_IN_BYTES / (1024 * 1024));
const MAX_CROP_SOURCE_SIZE_IN_MEGABYTES = Math.round(
  MAX_CROP_SOURCE_SIZE_IN_BYTES / (1024 * 1024),
);

/**
 * Gallery editor.
 *
 * Picked files are cropped in the browser, then travel straight to Vercel Blob
 * with a short-lived token from `/api/admin/uploads`; only the resulting URLs
 * go with the form. The order of `images` is the gallery order — every row
 * renders a hidden `imageUrl` input in sequence and the first is the thumbnail —
 * so reordering is a plain array move, courtesy of dnd-kit.
 */
export function ProductImageField({ initialImages, error }: ProductImageFieldProps) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Every preview URL handed to the cropper, so unmounting mid-crop cannot leak them.
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = objectUrlsRef.current;

    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeFile = queue[0] ?? null;
  const isBusy = isUploading || activeFile !== null;
  const isFull = images.length >= MAX_GALLERY_IMAGES;

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    // Reset so picking the same file twice still fires a change event.
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const room = Math.max(0, MAX_GALLERY_IMAGES - images.length);
    const accepted = files.slice(0, room);
    const unsupported = accepted.find((file) => !ALLOWED_TYPES.has(file.type));

    if (unsupported) {
      setUploadError(`${unsupported.name} is not a JPEG, PNG, WebP or AVIF image.`);
      return;
    }

    const oversized = accepted.find((file) => file.size > MAX_CROP_SOURCE_SIZE_IN_BYTES);

    if (oversized) {
      setUploadError(`${oversized.name} is larger than ${MAX_CROP_SOURCE_SIZE_IN_MEGABYTES} MB.`);
      return;
    }

    setUploadError(null);
    // One dialog per file: the queue advances as each crop is uploaded.
    setQueue(
      accepted.map((file, index) => {
        const previewUrl = URL.createObjectURL(file);
        objectUrlsRef.current.push(previewUrl);

        return { id: `${file.name}-${file.size}-${index}`, file, previewUrl };
      }),
    );
  }

  async function handleCropConfirm(cropped: File) {
    const [current, ...rest] = queue;

    if (!current) {
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const blob = await upload(cropped.name, cropped, {
        access: "public",
        handleUploadUrl: "/api/admin/uploads",
        contentType: cropped.type,
      });

      setImages((values) => [...values, blob.url].slice(0, MAX_GALLERY_IMAGES));
      releasePreviews([current]);
      setQueue(rest);
    } catch (cause) {
      setUploadError(cause instanceof Error ? cause.message : "Upload failed. Try again.");
      releasePreviews(queue);
      setQueue([]);
    } finally {
      setIsUploading(false);
    }
  }

  function releasePreviews(items: QueuedFile[]) {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }

  function handleCropCancel() {
    releasePreviews(queue);
    setQueue([]);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setImages((current) => {
      const from = current.indexOf(String(active.id));
      const to = current.indexOf(String(over.id));

      return from === -1 || to === -1 ? current : arrayMove(current, from, to);
    });
  }

  function makeThumbnail(url: string) {
    setImages((current) => {
      const index = current.indexOf(url);

      return index <= 0 ? current : arrayMove(current, index, 0);
    });
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {images.map((url, index) => (
                <SortableImageCard
                  key={url}
                  url={url}
                  index={index}
                  isBusy={isBusy}
                  onRemove={removeImage}
                  onMakeThumbnail={makeThumbnail}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
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
          disabled={isFull || isBusy}
          onChange={handleFiles}
          aria-invalid={Boolean(error) || Boolean(uploadError)}
          className="h-auto cursor-pointer py-2 file:mr-3"
        />
        <p className="text-xs text-muted-foreground">
          {isFull
            ? `Gallery full (${MAX_GALLERY_IMAGES} images). Remove one to add another.`
            : `Up to ${MAX_GALLERY_IMAGES} images. Each file is cropped in the browser before it uploads, so the sent image stays under ${MAX_IMAGE_SIZE_IN_MEGABYTES} MB.`}
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

      {activeFile ? (
        <ImageCropDialog
          key={activeFile.id}
          file={activeFile.file}
          previewUrl={activeFile.previewUrl}
          position={{ current: images.length + 1, total: images.length + queue.length }}
          isUploading={isUploading}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      ) : null}
    </div>
  );
}
