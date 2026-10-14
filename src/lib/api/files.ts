import { apiJson, apiUrl, ApiClientError } from "@/lib/api/client";
import { getAccessToken } from "@/lib/session";
import type { DocumentMeta } from "@/lib/types";

export type UploadedFile = {
  id: string;
  file_id?: string;
  original_name: string;
  mime_type: string;
  size: number;
};

export function documentFileId(doc: DocumentMeta): string {
  const extra = doc as DocumentMeta & { file_id?: string; fileId?: string };
  return String(doc.id || extra.file_id || extra.fileId || "").trim();
}

export function normalizeDocuments(docs: unknown): DocumentMeta[] {
  if (!Array.isArray(docs)) return [];
  return docs.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    const id = String(row.id || row.file_id || row.fileId || "").trim();
    const url = typeof row.url === "string" ? row.url.trim() : "";
    return {
      id: id || undefined,
      name: String(row.name || row.original_name || "photo"),
      size: Number(row.size) || 0,
      url: url || undefined,
    };
  });
}

function isLivePublicHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "ms.apptriangle.com" || host === "www.ms.apptriangle.com";
}

/** Live host: Next `/upload/files` (old /api has no files). Local: FastAPI `/api/v1/files`. */
function uploadPath() {
  return isLivePublicHost() ? "/upload/files" : "/api/v1/files";
}

function contentPath(id: string) {
  const tail = `/${encodeURIComponent(id)}/content`;
  return isLivePublicHost() ? `/upload/files${tail}` : `/api/v1/files${tail}`;
}

export const IMAGE_MAX_BYTES = Math.round(2.5 * 1024 * 1024);
export const MEMBER_IMAGE_ACCEPT =
  "image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.avif";

const IMAGE_EXTS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "heic",
  "heif",
  "avif",
  "tif",
  "tiff",
]);

const HEIC_BRANDS = new Set([
  "heic",
  "heix",
  "heif",
  "hevc",
  "heim",
  "heis",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

type ImageKind =
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "bmp"
  | "heic"
  | "avif"
  | "tiff"
  | "pdf"
  | "other";

function fileExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function jpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim() || "photo";
  return `${base}.jpg`;
}

async function sniffImageKind(file: File): Promise<ImageKind> {
  const buf = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "png";
  }
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38
  ) {
    return "gif";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "webp";
  }
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return "bmp";
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "pdf";
  }
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    const brand = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]).toLowerCase();
    if (HEIC_BRANDS.has(brand)) return "heic";
    if (brand === "avif" || brand === "avis") return "avif";
  }
  if (buf.length >= 4 && buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) {
    return "tiff";
  }
  if (buf.length >= 4 && buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a) {
    return "tiff";
  }
  return "other";
}

function isBrowserImage(kind: ImageKind): boolean {
  return kind === "jpeg" || kind === "png" || kind === "gif" || kind === "webp" || kind === "bmp";
}

function looksLikeImage(file: File, kind: ImageKind): boolean {
  if (isBrowserImage(kind) || kind === "heic" || kind === "avif" || kind === "tiff") {
    return true;
  }
  if (file.type.startsWith("image/")) return true;
  return IMAGE_EXTS.has(fileExt(file.name));
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode"));
    img.src = url;
  });
}

type Raster = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
};

async function rasterizeImage(source: Blob): Promise<Raster> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(source);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
        close: () => bitmap.close(),
      };
    } catch {
      /* Phone HEIC/AVIF often needs HTMLImageElement. */
    }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = await loadHtmlImage(url);
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, width, height) => ctx.drawImage(img, 0, 0, width, height),
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

async function encodeJpeg(raster: Raster, maxBytes: number): Promise<Blob> {
  let quality = 0.86;
  let maxEdge = 1920;
  let last: Blob | null = null;
  for (let i = 0; i < 7; i += 1) {
    const scale = Math.min(1, maxEdge / Math.max(raster.width, raster.height, 1));
    const width = Math.max(1, Math.round(raster.width * scale));
    const height = Math.max(1, Math.round(raster.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    raster.draw(ctx, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob) {
      last = blob;
      if (blob.size <= maxBytes) return blob;
    }
    quality = Math.max(0.45, quality - 0.1);
    maxEdge = Math.round(maxEdge * 0.78);
  }
  if (last && last.size <= maxBytes) return last;
  throw new ApiClientError(
    413,
    "FILE_TOO_LARGE",
    "Photo is too large. Use an image up to 2.5 MB.",
  );
}

/** Camera HEIC/AVIF and oversized shots become a JPEG the API and preview can open. */
export async function prepareMemberImage(file: File): Promise<File> {
  const kind = await sniffImageKind(file);
  if (kind === "pdf" || !looksLikeImage(file, kind)) {
    throw new ApiClientError(
      400,
      "FILE_NOT_IMAGE",
      "Only photos are allowed (JPG, PNG, WEBP, HEIC). Documents are not accepted.",
    );
  }
  const sendAsIs = isBrowserImage(kind) && file.size <= IMAGE_MAX_BYTES;
  if (sendAsIs && (kind === "jpeg" || kind === "png" || kind === "webp" || kind === "gif")) {
    return file;
  }
  try {
    const raster = await rasterizeImage(file);
    try {
      const blob = await encodeJpeg(raster, IMAGE_MAX_BYTES);
      return new File([blob], jpegName(file.name), { type: "image/jpeg" });
    } finally {
      raster.close();
    }
  } catch (err) {
    if (err instanceof ApiClientError) throw err;
    throw new ApiClientError(
      400,
      "FILE_CONVERT",
      "This photo could not be read. Try another image or retake the picture.",
    );
  }
}

export async function uploadFile(
  file: File,
  opts: { entity_type?: string; entity_id?: string; public?: boolean } = {},
) {
  const ready = await prepareMemberImage(file);
  const body = new FormData();
  body.append("upload", ready);
  body.append("entity_type", opts.entity_type ?? "");
  body.append("entity_id", opts.entity_id ?? "");
  const path = opts.public ? "/api/v1/public/files" : uploadPath();
  return apiJson<UploadedFile>(path, { method: "POST", body });
}

export type DocumentKind = "image" | "pdf" | "file";

export type LoadedDocument = {
  url: string;
  name: string;
  kind: DocumentKind;
  /** False for public http URLs — do not revoke those. */
  owned: boolean;
};

function mimeFromName(name: string): string {
  const ext = fileExt(name);
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "bmp") return "image/bmp";
  if (ext === "heic" || ext === "heif") return "image/heic";
  if (ext === "avif") return "image/avif";
  if (ext === "pdf") return "application/pdf";
  return "";
}

function typedBlob(blob: Blob, name: string): Blob {
  if (blob.type && blob.type !== "application/octet-stream") return blob;
  const mime = mimeFromName(name);
  return mime ? new Blob([blob], { type: mime }) : blob;
}

export function documentKind(name: string, mime = ""): DocumentKind {
  const type = mime || mimeFromName(name);
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf") return "pdf";
  return "file";
}

async function previewableImageBlob(blob: Blob, name: string): Promise<Blob> {
  const mime = blob.type || mimeFromName(name);
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/gif" || mime === "image/webp") {
    return blob;
  }
  if (!mime.startsWith("image/")) return blob;
  try {
    const raster = await rasterizeImage(blob);
    try {
      return await encodeJpeg(raster, IMAGE_MAX_BYTES);
    } finally {
      raster.close();
    }
  } catch {
    return blob;
  }
}

export async function downloadFileBlob(fileId: string): Promise<Blob> {
  const headers = new Headers({ Accept: "*/*" });
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(contentPath(fileId)), {
    headers,
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as
      | { detail?: string; message?: string }
      | null;
    throw new ApiClientError(
      res.status,
      "FILE_DOWNLOAD",
      problem?.detail || problem?.message || "Could not open this photo.",
    );
  }
  return res.blob();
}

function isPublicHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    return !parsed.pathname.includes("/api/v1/files");
  } catch {
    return false;
  }
}

export async function loadStoredDocument(doc: DocumentMeta): Promise<LoadedDocument> {
  const id = documentFileId(doc);
  if (id) {
    const raw = typedBlob(await downloadFileBlob(id), doc.name);
    const blob = await previewableImageBlob(raw, doc.name);
    return {
      url: URL.createObjectURL(blob),
      name: doc.name,
      kind: documentKind(doc.name, blob.type || raw.type),
      owned: true,
    };
  }
  const url = doc.url?.trim() ?? "";
  if (url && isPublicHttpUrl(url)) {
    return {
      url,
      name: doc.name,
      kind: documentKind(doc.name),
      owned: false,
    };
  }
  throw new ApiClientError(404, "FILE_DOWNLOAD", "Could not open this photo.");
}

/** Open a member photo with the staff token. Do not `window.open` API file URLs. */
export async function openStoredDocument(doc: DocumentMeta) {
  const loaded = await loadStoredDocument(doc);
  if (loaded.kind === "file") {
    const link = document.createElement("a");
    link.href = loaded.url;
    link.download = loaded.name;
    link.click();
  } else {
    window.open(loaded.url, "_blank", "noopener,noreferrer");
  }
  if (loaded.owned) {
    window.setTimeout(() => URL.revokeObjectURL(loaded.url), 60_000);
  }
}
