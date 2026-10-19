import { MAX_ICON_BYTES, MAX_UPLOAD_BYTES } from "./validation";
import { t } from "./i18n";

const ICON_SIZE = 128;

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(t().lib.images.readFailed));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (char) =>
    char.charCodeAt(0),
  );
  return new Blob([bytes], { type: "image/webp" });
}

export async function optimizeImage(file: Blob): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(t().lib.images.typeUnsupported);
  if (!file.size || file.size > MAX_UPLOAD_BYTES)
    throw new Error(t().lib.images.imageTooLarge);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(t().lib.images.decodeFailed);
  }
  try {
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t().lib.images.canvasUnavailable);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.88),
    );
    if (!blob || blob.type !== "image/webp" || blob.size > MAX_UPLOAD_BYTES)
      throw new Error(t().lib.images.imageConvertFailed);
    return blob;
  } finally {
    bitmap.close();
  }
}

/**
 * Centre-crops to a square and downscales, so a shortcut icon is a few KB and
 * can live inside the state (and therefore inside a backup) rather than in the
 * asset store.
 */
export async function optimizeIcon(file: Blob): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error(t().lib.images.typeUnsupported);
  if (!file.size || file.size > MAX_ICON_BYTES)
    throw new Error(t().lib.images.iconTooLarge);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(t().lib.images.decodeFailed);
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (side < 1) throw new Error(t().lib.images.emptyPixels);
    const canvas = document.createElement("canvas");
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t().lib.images.canvasUnavailable);
    ctx.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      ICON_SIZE,
      ICON_SIZE,
    );
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8),
    );
    if (!blob || blob.type !== "image/webp")
      throw new Error(t().lib.images.iconConvertFailed);
    return await blobToDataUrl(blob);
  } finally {
    bitmap.close();
  }
}

export async function validateDecodedWallpaper(blob: Blob): Promise<void> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error(t().lib.images.wallpaperCorrupt);
  }
  const valid =
    bitmap.width > 0 &&
    bitmap.height > 0 &&
    Math.max(bitmap.width, bitmap.height) <= 2560;
  bitmap.close();
  if (!valid) throw new Error(t().lib.images.wallpaperSize);
}
