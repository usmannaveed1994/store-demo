import { MAX_CROPPED_IMAGE_DIMENSION, MAX_IMAGE_SIZE_IN_BYTES } from "./constants";

/** Pixel rectangle the cropper reports for the framed area. */
export type CropAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const MAX_IMAGE_SIZE_IN_MEGABYTES = Math.round(MAX_IMAGE_SIZE_IN_BYTES / (1024 * 1024));

/** Tried in order until the encoded file fits the upload limit. */
const QUALITY_STEPS = [0.9, 0.8, 0.7];

/**
 * Extensions for the formats a canvas can encode.
 *
 * `toBlob` honours the requested type only when the browser supports encoding
 * it — Safari falls back to PNG for WebP — so the file is named from the blob
 * that actually came back.
 */
const EXTENSIONS: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This file could not be read as an image."));
    image.src = source;
  });
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("This browser could not encode the cropped image."));
        }
      },
      "image/webp",
      quality,
    );
  });
}

/**
 * Cuts `area` out of `file`, downscales it and re-encodes it for upload.
 *
 * Runs entirely in the browser: the original file never leaves the page, only
 * the returned `File` is sent to Vercel Blob.
 */
export async function cropImageFile(file: File, area: CropAreaPixels): Promise<File> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_CROPPED_IMAGE_DIMENSION / Math.max(area.width, area.height));
    const width = Math.max(1, Math.round(area.width * scale));
    const height = Math.max(1, Math.round(area.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("This browser cannot crop images.");
    }

    context.imageSmoothingQuality = "high";
    context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height);

    let blob = await encode(canvas, QUALITY_STEPS[0]);

    for (const quality of QUALITY_STEPS.slice(1)) {
      if (blob.size <= MAX_IMAGE_SIZE_IN_BYTES) {
        break;
      }

      blob = await encode(canvas, quality);
    }

    if (blob.size > MAX_IMAGE_SIZE_IN_BYTES) {
      throw new Error(
        `The cropped image is still larger than ${MAX_IMAGE_SIZE_IN_MEGABYTES} MB. Try a smaller area.`,
      );
    }

    const type = EXTENSIONS[blob.type] ? blob.type : "image/png";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";

    return new File([blob], `${baseName}-cropped.${EXTENSIONS[type]}`, { type });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
