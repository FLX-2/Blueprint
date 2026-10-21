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
    icons: [{ src: "/icons/blueprint.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
