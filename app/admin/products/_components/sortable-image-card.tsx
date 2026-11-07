"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isRemoteUrl } from "@/lib/images";
import { cn } from "@/lib/utils";

type SortableImageCardProps = {
  url: string;
  index: number;
  isBusy: boolean;
  onRemove: (url: string) => void;
  onMakeThumbnail: (url: string) => void;
};

/**
 * One gallery photo that can be dragged into a new position.
 *
 * The drag listeners sit on the grip rather than the whole card, so the buttons
 * below stay clickable and the grid keeps a single, deliberate drag target.
 * `touch-none` on that grip is what lets the pointer sensor take over a touch
 * gesture instead of scrolling the page.
 */
export function SortableImageCard({
  url,
  index,
  isBusy,
  onRemove,
  onMakeThumbnail,
}: SortableImageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: url,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-background p-2",
        isDragging && "z-10 border-foreground/40 opacity-60 shadow-lg",
      )}
    >
      <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
        <Image
          src={url}
          alt=""
          fill
          sizes="160px"
          className="object-cover"
          unoptimized={isRemoteUrl(url)}
        />
        <span className="absolute top-1.5 left-1.5 rounded-full bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold text-background">
          {index + 1}
        </span>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder image ${index + 1}`}
          className="absolute top-1.5 right-1.5 cursor-grab touch-none rounded-md bg-background/85 p-1 text-muted-foreground shadow-xs transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-muted-foreground">
          {index === 0 ? "Thumbnail" : `Image ${index + 1}`}
        </span>
        <div className="flex items-center">
          {index > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isBusy}
              onClick={() => onMakeThumbnail(url)}
              aria-label={`Make image ${index + 1} the thumbnail`}
              title="Make thumbnail"
            >
              <Star />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={isBusy}
            onClick={() => onRemove(url)}
            aria-label={`Remove image ${index + 1}`}
            title="Remove"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </li>
  );
}
