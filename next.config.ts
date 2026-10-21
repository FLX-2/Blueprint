import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    // Connectivity-aware UI (useOffline) and retries of navigations that fail offline.
    useOffline: true,
  },
  // Demo mode always has an active program. With real accounts, "/" becomes:
  // today's session if one is scheduled, else /plan, else /welcome.
  async redirects() {
    return [{ source: "/", destination: "/plan", permanent: false }];
  },
  async headers() {
    return [
      {
        // The service worker must never be cached, or updates would never reach installed apps.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
