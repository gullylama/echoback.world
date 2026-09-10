import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echoback.world";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in surfaces: nothing here is useful to a crawler, and profile
      // pages carry people's names and work.
      disallow: ["/api/", "/auth/", "/studio", "/feed", "/inbox", "/account", "/upload", "/matches/", "/profile/", "/reset"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
