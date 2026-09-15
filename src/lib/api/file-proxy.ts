/** Server-only: forward member file traffic to the Docker API, not api.ms. */
export function dockerApiOrigin() {
  return (
    process.env.API_PROXY_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

export async function proxyToDockerApi(req: Request, apiPath: string) {
  const target = `${dockerApiOrigin()}${apiPath}${new URL(req.url).search}`;
  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }
  const res = await fetch(target, init);
  const out = new Headers(res.headers);
  out.delete("transfer-encoding");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}
