import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oswal Service",
    short_name: "Oswal",
    description: "Service desk for Oswal Pumps and Oswal Solar",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f5",
    theme_color: "#02502f",
    icons: [
      { src: "/brand/pumps-logo.png", sizes: "360x373", type: "image/png", purpose: "any" },
      { src: "/brand/pumps-favicon.png", sizes: "32x27", type: "image/png" },
    ],
  };
}
