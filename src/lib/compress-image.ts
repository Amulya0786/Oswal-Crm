const MAX_PHOTO_BYTES = 1_000_000;

function blobOf(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Shrink a photo in the browser. Starts at 1600px and quality 0.7, then lowers both until the file is about 1MB. */
export async function compressImage(file: File) {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  let edge = 1600;
  let quality = 0.7;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await blobOf(canvas, quality);
    if (blob && blob.size <= MAX_PHOTO_BYTES) break;
    quality = Math.max(0.35, quality - 0.1);
    edge = Math.max(800, Math.round(edge * 0.8));
  }
  bitmap.close();
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
