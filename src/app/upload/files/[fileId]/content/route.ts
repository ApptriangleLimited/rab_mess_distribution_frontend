import { proxyToDockerApi } from "@/lib/api/file-proxy";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;
  return proxyToDockerApi(
    req,
    `/api/v1/files/${encodeURIComponent(fileId)}/content`,
  );
}
