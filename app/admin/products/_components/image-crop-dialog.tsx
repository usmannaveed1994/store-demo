"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cropImageFile } from "@/lib/products/crop-image";

/** 4:3 first: it matches the catalogue tile the thumbnail is shown in. */
const ASPECT_OPTIONS = [
  { value: 4 / 3, label: "4:3" },
  { value: 1, label: "1:1" },
  { value: 16 / 9, label: "16:9" },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

type ImageCropDialogProps = {
  file: File;
  /** Object URL of `file`, owned and revoked by the parent. */
  previewUrl: string;
  /** Where this file sits in the batch, so a multi-file pick reads as progress. */
  position: { current: number; total: number };
  isUploading: boolean;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
};

/**
 * Crops one picked file before it is uploaded.
 *
 * The dialog is controlled but never dismissed by the parent directly: it
 * reports upstream, which then advances its queue or closes. Escape and the
 * overlay both route through `onCancel`, so a cancelled crop cannot strand the
 * queue mid-way.
 */
export function ImageCropDialog({
  file,
  previewUrl,
  position,
  isUploading,
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [aspect, setAspect] = useState(ASPECT_OPTIONS[0].value);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  const isBusy = isCropping || isUploading;

  function handleAspectChange(nextAspect: number) {
    setAspect(nextAspect);
    setCrop({ x: 0, y: 0 });
    setZoom(MIN_ZOOM);
    setCroppedAreaPixels(null);
  }

  function handleCropComplete(_croppedArea: Area, areaPixels: Area) {
    setCroppedAreaPixels(areaPixels);
  }

  async function handleConfirm() {
    if (!croppedAreaPixels || isBusy) {
      return;
    }

    setCropError(null);
    setIsCropping(true);

    try {
      onConfirm(await cropImageFile(file, croppedAreaPixels));
    } catch (cause) {
      setCropError(cause instanceof Error ? cause.message : "Could not crop this image.");
    } finally {
      setIsCropping(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl" showCloseButton={!isBusy}>
        <DialogHeader>
          <DialogTitle>Crop image</DialogTitle>
          <DialogDescription>
            Image {position.current} of {position.total} · drag to reposition, then zoom to frame it.
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-64 overflow-hidden rounded-lg bg-foreground/90 sm:h-80">
          <Cropper
            image={previewUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            objectFit="contain"
            showGrid
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Aspect</span>
            {ASPECT_OPTIONS.map((option) => (
              <Button
                key={option.label}
                type="button"
                size="sm"
                variant={aspect === option.value ? "default" : "outline"}
                disabled={isBusy}
                onClick={() => handleAspectChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <label className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="w-10 shrink-0">Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              disabled={isBusy}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer accent-foreground"
            />
          </label>
        </div>

        {cropError ? (
          <p role="alert" className="text-xs text-destructive">
            {cropError}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isBusy || !croppedAreaPixels}>
            {isCropping ? "Cropping…" : isUploading ? "Uploading…" : "Crop & upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
