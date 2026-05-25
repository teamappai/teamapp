import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/marketing/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated app + auth flows should never be indexed.
      disallow: ["/app/", "/login", "/signup", "/api/"],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
