/**
 * Phone photo → web photo, entirely in the browser.
 * HEIC/HEIF (iPhone) is decoded with heic2any, loaded only when needed.
 * Re-encoding through a canvas drops ALL metadata (EXIF, GPS, camera serial).
 * Output: WebP, long edge ≤ 2000px, ≤ ~1 MB. Browsers that can't encode WebP
 * (older Safari) fall back to JPEG with the same limits.
 */
export const MAX_PHOTOS = 20;
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const LONG_EDGE = 2000;
export const TARGET_BYTES = 1024 * 1024;

export type Processed = { blob: Blob; ext: "webp" | "jpg"; width: number; height: number; origSize: number };

export class ImageError extends Error {}

const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);
const isSupported = (f: File) => isHeic(f) || /^image\/(jpeg|png|webp)$/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);

async function decodeHeic(file: File): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(out) ? out[0] : out;
}

async function toBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // honour EXIF orientation before the metadata is thrown away
      return await createImageBitmap(blob, { imageOrientation: "from-image" });
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob> {
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new ImageError("Couldn't encode photo"))), type, q));
}

function draw(src: ImageBitmap | HTMLImageElement, longEdge: number) {
  const w0 = "naturalWidth" in src ? src.naturalWidth : src.width;
  const h0 = "naturalHeight" in src ? src.naturalHeight : src.height;
  const k = Math.min(1, longEdge / Math.max(w0, h0));
  const w = Math.round(w0 * k);
  const h = Math.round(h0 * k);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

export async function processImage(file: File): Promise<Processed> {
  if (!isSupported(file)) throw new ImageError(`${file.name}: use a JPEG, PNG or HEIC photo`);
  if (file.size > MAX_INPUT_BYTES) throw new ImageError(`${file.name} is over 15 MB`);
  const input = isHeic(file) ? await decodeHeic(file) : file;
  const bmp = await toBitmap(input);
  let edge = LONG_EDGE;
  let last: { blob: Blob; c: HTMLCanvasElement } | null = null;
  for (let pass = 0; pass < 3; pass++) {
    const c = draw(bmp, edge);
    for (const q of [0.8, 0.7, 0.6]) {
      let blob = await encode(c, "image/webp", q);
      if (blob.type !== "image/webp") blob = await encode(c, "image/jpeg", q); // no WebP encoder
      last = { blob, c };
      if (blob.size <= TARGET_BYTES) break;
    }
    if (last!.blob.size <= TARGET_BYTES) break;
    edge = Math.round(edge * 0.8);
  }
  if ("close" in bmp) bmp.close();
  const { blob, c } = last!;
  return { blob, ext: blob.type === "image/webp" ? "webp" : "jpg", width: c.width, height: c.height, origSize: file.size };
}

export const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
