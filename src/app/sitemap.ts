import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://echoback.world";

/** Only the pages a signed-out visitor can actually reach. */
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date();
  return [
    { url: SITE, lastModified: updated, priority: 1 },
    { url: `${SITE}/pricing`, lastModified: updated, priority: 0.8 },
    { url: `${SITE}/start`, lastModified: updated, priority: 0.8 },
    { url: `${SITE}/legal/rights`, lastModified: updated, priority: 0.3 },
    { url: `${SITE}/legal/privacy`, lastModified: updated, priority: 0.3 },
    { url: `${SITE}/legal/terms`, lastModified: updated, priority: 0.3 },
  ];
}
