import type { NextConfig } from "next";

const API_ON = (() => {
  const raw = process.env.NEXT_PUBLIC_USE_API?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
})();

const ZK_DEMO_ON = (() => {
  const raw = process.env.NEXT_PUBLIC_ZK_DEMO?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
})();

/** Proxy /api/v1 → FastAPI when full API mode or ZK demo-only. */
const PROXY_API = API_ON || ZK_DEMO_ON;

const API_BASE = (
  process.env.API_PROXY_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
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
