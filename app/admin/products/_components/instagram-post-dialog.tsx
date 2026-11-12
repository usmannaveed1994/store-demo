"use client";

import Image from "next/image";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isRemoteUrl } from "@/lib/images";
import { countCaptionCharacters } from "@/lib/instagram/caption";
import { MAX_CAPTION_LENGTH } from "@/lib/instagram/constants";
import type { InstagramPostState } from "@/lib/instagram/types";
import { cn } from "@/lib/utils";

import { InstagramIcon } from "./instagram-icon";

const IDLE_STATE: InstagramPostState = { status: "idle" };
const MAX_PREVIEW_IMAGES = 5;

type InstagramPostDialogProps = {
  productId: string;
  productTitle: string;
  /** Starting point for the editable caption. */
  caption: string;
  images: string[];
  /** The caption links to the storefront, so a local origin is worth flagging. */
  siteIsLocal: boolean;
  action: (state: InstagramPostState, formData: FormData) => Promise<InstagramPostState>;
};

/**
 * Confirms a public post before it happens.
 *
 * The dialog shows exactly what Instagram will receive — photos, caption and the
 * link — because a published post cannot be edited, only deleted. The caption is
 * editable, so last-minute wording changes do not need a trip to the product form.
 * The outcome lands in a toast so it stays readable after the dialog closes.
 */
export function InstagramPostDialog({
  productId,
  productTitle,
  caption,
  images,
  siteIsLocal,
  action,
}: InstagramPostDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [captionValue, setCaptionValue] = useState(caption);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const captionId = `instagram-caption-${productId}`;
  const captionCountId = `${captionId}-count`;
  const captionLength = countCaptionCharacters(captionValue);
  const captionTooLong = captionLength > MAX_CAPTION_LENGTH;
  const canPublish = !isPending && !captionTooLong && captionValue.trim().length > 0;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setErrorMessage(null);

    // Every open starts from the generated caption, never a previous edit.
    if (next) {
      setCaptionValue(caption);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setErrorMessage(null);

    startTransition(async () => {
      const result = await action(IDLE_STATE, formData);

      if (result.status === "error") {
        // The dialog stays open, so a retry does not need a second click.
        setErrorMessage(result.message);
        toast.error("Instagram post failed", {
          description: result.message,
          duration: 10_000,
        });
        return;
      }

      if (result.status !== "success") {
        return;
      }

      const { permalink } = result;

      setOpen(false);
      toast.success("Posted to Instagram", {
        description: productTitle,
        action: permalink
          ? { label: "View post", onClick: () => window.open(permalink, "_blank", "noopener") }
          : undefined,
      });
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={images.length === 0}
          title={images.length === 0 ? "Add a product image first" : undefined}
        >
          <InstagramIcon />
          Post
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Post to Instagram</DialogTitle>
            <DialogDescription>
              {images.length === 1
                ? "Publishes this photo with the caption below."
                : `Publishes a carousel of ${images.length} photos with the caption below.`}{" "}
              The post is public as soon as it is published.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {images.slice(0, MAX_PREVIEW_IMAGES).map((url) => (
              <Image
                key={url}
                src={url}
                alt=""
                width={64}
                height={64}
                className="size-16 rounded-md border border-border object-cover"
                unoptimized={isRemoteUrl(url)}
              />
            ))}
            {images.length > MAX_PREVIEW_IMAGES ? (
              <span className="flex size-16 items-center justify-center rounded-md border border-border text-xs text-muted-foreground">
                +{images.length - MAX_PREVIEW_IMAGES}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor={captionId}
              className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
            >
              Caption
            </Label>
            <Textarea
              id={captionId}
              name="caption"
              value={captionValue}
              onChange={(event) => setCaptionValue(event.target.value)}
              disabled={isPending}
              rows={6}
              aria-invalid={captionTooLong ? true : undefined}
              aria-describedby={captionCountId}
              className="max-h-48 overflow-y-auto"
            />
            <span
              id={captionCountId}
              className={cn(
                "self-end text-xs tabular-nums",
                captionTooLong ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {captionLength} / {MAX_CAPTION_LENGTH}
            </span>
          </div>

          {siteIsLocal ? (
            <p className="text-xs text-muted-foreground">
              This store resolves to localhost, so the product link will not open for anyone
              else. Set <code className="font-mono">APP_URL</code> to the public domain before
              posting for real.
            </p>
          ) : null}

          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>

            <input type="hidden" name="id" value={productId} />
            <Button type="submit" disabled={!canPublish}>
              <InstagramIcon />
              {isPending ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
