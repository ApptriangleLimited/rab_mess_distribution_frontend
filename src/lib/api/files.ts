import { apiJson, apiUrl, ApiClientError } from "@/lib/api/client";
import { getAccessToken } from "@/lib/session";

export type UploadedFile = {
  id: string;
  original_name: string;
  mime_type: string;
  size: number;
};

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
  const res = await fetch(apiUrl(`/api/v1/files/${fileId}/content`), { headers });
  if (!res.ok) {
    throw new ApiClientError(res.status, "FILE_DOWNLOAD", "Could not open document.");
  }
  return res.blob();
}
