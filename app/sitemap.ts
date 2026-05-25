import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/marketing/site";

/** Public, indexable marketing routes. Authenticated /app/* paths are excluded. */
const ROUTES = [
  "/",
  "/features",
  "/pricing",
  "/for-team-leads",
  "/for-agents",
  "/demo",
  "/security",
  "/contact",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: new URL(route, SITE_URL).toString(),
    lastModified,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
