import type { MetadataRoute } from "next";

const BASE = "https://az-house-bois.vercel.app";

// Public pages only. Authed/admin pages (/admin, /dashboard, /book/[id])
// are deliberately excluded so search engines never index them.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: {
    path: string;
    changeFrequency: "weekly" | "monthly" | "yearly";
    priority: number;
  }[] = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
    { path: "/roster", changeFrequency: "weekly", priority: 0.8 },
    { path: "/apply", changeFrequency: "monthly", priority: 0.8 },
    { path: "/signup", changeFrequency: "monthly", priority: 0.7 },
    { path: "/login", changeFrequency: "yearly", priority: 0.5 },
  ];
  return pages.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: new Date(),
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
