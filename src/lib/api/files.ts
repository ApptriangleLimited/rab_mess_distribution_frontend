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
      name: String(row.name || row.original_name || "document"),
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
/** Send PNG/JPG as-is through 2.5 MB. Only shrink bigger camera shots. */
const KEEP_AS_IS_BYTES = Math.round(2.5 * 1024 * 1024);

async function compressImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!blob || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

async function prepareUploadFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= KEEP_AS_IS_BYTES) return file;
  try {
    return await compressImage(file);
  } catch {
    return file;
  }
}

export async function uploadFile(
  file: File,
  opts: { entity_type?: string; entity_id?: string } = {},
) {
  const ready = await prepareUploadFile(file);
  const body = new FormData();
  body.append("upload", ready);
  body.append("entity_type", opts.entity_type ?? "");
  body.append("entity_id", opts.entity_id ?? "");
  return apiJson<UploadedFile>(uploadPath(), { method: "POST", body });
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
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "bmp") return "image/bmp";
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

export async function downloadFileBlob(fileId: string): Promise<Blob> {
  const headers = new Headers({ Accept: "*/*" });
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(contentPath(fileId)), {
    headers,
  });
  if (!res.ok) {
    throw new ApiClientError(res.status, "FILE_DOWNLOAD", "Could not open document.");
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
    const blob = typedBlob(await downloadFileBlob(id), doc.name);
    return {
      url: URL.createObjectURL(blob),
      name: doc.name,
      kind: documentKind(doc.name, blob.type),
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
  throw new ApiClientError(404, "FILE_DOWNLOAD", "Could not open document.");
}

/** Open a member document with the staff token. Do not `window.open` API file URLs. */
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
