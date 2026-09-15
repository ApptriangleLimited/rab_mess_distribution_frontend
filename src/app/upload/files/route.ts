import { proxyToDockerApi } from "@/lib/api/file-proxy";

export const runtime = "nodejs";

export function POST(req: Request) {
  return proxyToDockerApi(req, "/api/v1/files");
}
