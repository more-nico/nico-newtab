import { MAX_ICON_BYTES, MAX_UPLOAD_BYTES } from "./validation";

const ICON_SIZE = 128;

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败。"));
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
    throw new Error("请选择 JPG、PNG 或 WebP 图片。");
  if (!file.size || file.size > MAX_UPLOAD_BYTES)
    throw new Error("图片大小需在 0–20 MB 之间。");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("无法解码这张图片，请换一张试试。");
  }
  try {
    const scale = Math.min(1, 2560 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器暂时无法处理图片。");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.88),
    );
    if (!blob || blob.type !== "image/webp" || blob.size > MAX_UPLOAD_BYTES)
      throw new Error("图片转换失败，请尝试较小的图片。");
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
    throw new Error("请选择 JPG、PNG 或 WebP 图片。");
  if (!file.size || file.size > MAX_ICON_BYTES)
    throw new Error("图标大小需在 0–5 MB 之间。");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("无法解码这张图片，请换一张试试。");
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    if (side < 1) throw new Error("这张图片没有可用的像素。");
    const canvas = document.createElement("canvas");
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器暂时无法处理图片。");
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
      throw new Error("图标转换失败，请换一张试试。");
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
    throw new Error("备份中的壁纸已损坏，原有数据未更改。");
  }
  const valid =
    bitmap.width > 0 &&
    bitmap.height > 0 &&
    Math.max(bitmap.width, bitmap.height) <= 2560;
  bitmap.close();
  if (!valid) throw new Error("备份中的图片尺寸不受支持。");
}
