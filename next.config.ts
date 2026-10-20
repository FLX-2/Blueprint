import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Demo mode always has an active program. With real accounts, "/" becomes:
  // today's session if one is scheduled, else /plan, else /welcome.
  async redirects() {
    return [{ source: "/", destination: "/plan", permanent: false }];
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
