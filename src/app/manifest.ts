import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blueprint",
    short_name: "Blueprint",
    description: "Paste any strength program and it runs itself. Ask your training history anything.",
    // Installed on a phone, it opens straight to today's session.
    start_url: "/train",
    display: "standalone",
    background_color: "#121311",
    theme_color: "#121311",
    // PNGs for install (Android needs 192 and 512; the maskable one keeps the glyph in the safe zone).
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/blueprint.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
