import * as cheerio from "cheerio";
import { fetchPage } from "./fetcher";

/**
 * Sitemap discovery, per docs/spec.md §12: prefer robots.txt-declared
 * sitemaps, fall back to the conventional /sitemap.xml. Handles a plain
 * urlset sitemap and one level of sitemap-index nesting (a sitemap index
 * pointing at child sitemaps) -- deeper nesting is out of scope for the
 * bounded per-company crawl this feeds.
 */

export async function discoverSitemapUrls(
  baseUrl: string,
  robotsSitemaps: string[]
): Promise<string[]> {
  const candidates = robotsSitemaps.length > 0 ? robotsSitemaps : [new URL("/sitemap.xml", baseUrl).toString()];

  const urls: string[] = [];

  for (const sitemapUrl of candidates) {
    try {
      const result = await fetchPage(sitemapUrl, { timeoutMs: 8_000, maxBytes: 5_000_000 });
      if (result.status !== 200) continue;

      const $ = cheerio.load(result.body, { xmlMode: true });

      const sitemapIndexEntries = $("sitemapindex > sitemap > loc")
        .map((_, el) => $(el).text().trim())
        .get();

      if (sitemapIndexEntries.length > 0) {
        // One level of nesting: fetch each child sitemap and collect its URLs.
        for (const childSitemapUrl of sitemapIndexEntries.slice(0, 5)) {
          try {
            const childResult = await fetchPage(childSitemapUrl, { timeoutMs: 8_000, maxBytes: 5_000_000 });
            if (childResult.status !== 200) continue;
            const $child = cheerio.load(childResult.body, { xmlMode: true });
            $child("urlset > url > loc").each((_, el) => {
              urls.push($child(el).text().trim());
            });
          } catch {
            // One broken child sitemap shouldn't abort discovery of the rest.
          }
        }
      } else {
        $("urlset > url > loc").each((_, el) => {
          urls.push($(el).text().trim());
        });
      }

      if (urls.length > 0) break; // first working candidate is enough
    } catch {
      // Try the next candidate sitemap URL.
    }
  }

  return Array.from(new Set(urls));
}
