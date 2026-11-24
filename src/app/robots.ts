import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/dashboard", "/api", "/book"],
      },
    ],
    sitemap: "https://az-house-bois.vercel.app/sitemap.xml",
  };
}
