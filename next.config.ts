import path from "node:path";
import type { NextConfig } from "next";

const projectRoot = path.resolve(__dirname);

const API_ON = (() => {
  const raw = process.env.NEXT_PUBLIC_USE_API?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
})();

const ZK_DEMO_ON = (() => {
  const raw = process.env.NEXT_PUBLIC_ZK_DEMO?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
})();

const HAS_API_URL = Boolean(
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    process.env.API_PROXY_URL?.trim(),
);

/** Proxy /api/v1 → Docker FastAPI (never a remote host unless env says so). */
const PROXY_API = API_ON || ZK_DEMO_ON || HAS_API_URL;

const API_BASE = (
  process.env.API_PROXY_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  experimental: {
    proxyClientMaxBodySize: "8mb",
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  /** Hide the Next.js “N” route/bundler badge in local dev. */
  devIndicators: false,
  async rewrites() {
    if (!PROXY_API) return [];
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_BASE}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
