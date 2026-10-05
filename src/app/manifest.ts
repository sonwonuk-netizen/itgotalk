import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "잇고톡 연산",
    short_name: "잇고톡",
    start_url: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#eef6ff",
    theme_color: "#2563eb",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
