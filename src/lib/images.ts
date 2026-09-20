import { MAX_UPLOAD_BYTES } from "./validation";

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
