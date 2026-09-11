import { IMAGE_MAX_BYTES } from "./imageModel";

export const IMAGE_MAX_EDGE = 1600;
export const IMAGE_KEEP_BYTES = 450_000;
export const IMAGE_JPEG_QUALITY = 0.75;
export const IMAGE_JPEG_RETRY_QUALITY = 0.6;

export function scaleToMaxEdge(
  width: number,
  height: number,
  maxEdge = IMAGE_MAX_EDGE
): { width: number; height: number; scale: number } {
  const edge = Math.max(width, height, 1);
  if (edge <= maxEdge) return { width, height, scale: 1 };
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale
  };
}

export function shouldKeepOriginal(input: {
  width: number;
  height: number;
  bytes: number;
  type: string;
}): boolean {
  if (input.type === "image/gif" || input.type === "image/svg+xml") return true;
  if (input.type === "image/png" || input.type === "image/webp" || input.type === "image/bmp") {
    return false;
  }
  if (Math.max(input.width, input.height) > IMAGE_MAX_EDGE) return false;
  return input.bytes <= IMAGE_KEEP_BYTES;
}

export function outputMime(type: string, preferJpeg: boolean): "image/jpeg" | "image/png" {
  if (preferJpeg) return "image/jpeg";
  if (type === "image/png") return "image/png";
  return "image/jpeg";
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      if (!result.startsWith("data:image/")) reject(new Error("not-image"));
      else resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read-failed"));
    reader.readAsDataURL(file);
  });
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to HTMLImageElement */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode-failed"));
      el.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  mime: "image/jpeg" | "image/png",
  quality: number
): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL(mime, quality);
}

function closeBitmap(image: ImageBitmap | HTMLImageElement): void {
  if ("close" in image && typeof image.close === "function") image.close();
}

/** Downscale/re-encode camera photos so embedded Markdown stays small and interactive. */
export async function embedImageFile(file: Blob, type = file.type): Promise<string> {
  const original = await readAsDataUrl(file);
  if (typeof document === "undefined") return original;
  if (type === "image/gif" || type === "image/svg+xml") return original;

  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await loadBitmap(file);
  } catch {
    return original;
  }

  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const keep = shouldKeepOriginal({ width: srcW, height: srcH, bytes: file.size, type });
  if (keep) {
    closeBitmap(bitmap);
    return original;
  }

  const sized = scaleToMaxEdge(srcW, srcH);
  let encoded = canvasDataUrl(bitmap, sized.width, sized.height, "image/jpeg", IMAGE_JPEG_QUALITY);
  if (!encoded || encoded.length >= original.length) {
    if (sized.scale < 1) {
      encoded =
        canvasDataUrl(bitmap, sized.width, sized.height, "image/jpeg", IMAGE_JPEG_RETRY_QUALITY) ?? encoded;
    }
  }
  const maxChars = Math.floor(IMAGE_MAX_BYTES * (4 / 3)) + 128;
  if (encoded && encoded.length > maxChars) {
    const retry = canvasDataUrl(bitmap, sized.width, sized.height, "image/jpeg", IMAGE_JPEG_RETRY_QUALITY);
    if (retry && retry.length < encoded.length) encoded = retry;
  }
  closeBitmap(bitmap);
  if (!encoded) return original;
  return encoded.length < original.length || sized.scale < 1 ? encoded : original;
}

export async function embedImageSrc(src: string): Promise<string> {
  const url = src.trim();
  if (!url.startsWith("data:image/")) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const type = blob.type || url.slice(5, url.indexOf(";")) || "image/jpeg";
    return embedImageFile(blob, type);
  } catch {
    return url;
  }
}
