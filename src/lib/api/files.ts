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

export function uploadFile(
  file: File,
  opts: { entity_type?: string; entity_id?: string } = {},
) {
  const body = new FormData();
  body.append("upload", file);
  body.append("entity_type", opts.entity_type ?? "");
  body.append("entity_id", opts.entity_id ?? "");
  return apiJson<UploadedFile>("/api/v1/files", { method: "POST", body });
}

export async function downloadFileBlob(fileId: string): Promise<Blob> {
  const headers = new Headers({ Accept: "*/*" });
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(apiUrl(`/api/v1/files/${encodeURIComponent(fileId)}/content`), {
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

/** Open a member document with the staff token. Do not `window.open` API file URLs. */
export async function openStoredDocument(doc: DocumentMeta) {
  const id = documentFileId(doc);
  if (id) {
    const blob = await downloadFileBlob(id);
    const href = URL.createObjectURL(blob);
    window.open(href, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
    return;
  }
  const url = doc.url?.trim() ?? "";
  if (url && isPublicHttpUrl(url)) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  throw new ApiClientError(404, "FILE_DOWNLOAD", "Could not open document.");
}
