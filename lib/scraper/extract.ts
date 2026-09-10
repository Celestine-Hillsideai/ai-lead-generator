import * as cheerio from "cheerio";

/**
 * Extracts readable page text and the title, per docs/spec.md §12. Strips
 * non-content elements (script/style/nav/footer/etc.) so downstream agent
 * prompts aren't wasted on boilerplate.
 */

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "footer",
  "header",
  "svg",
  "iframe",
  "[aria-hidden='true']",
];

export interface ExtractedPage {
  title: string | null;
  text: string;
  links: string[];
}

export function extractPage(html: string, baseUrl: string): ExtractedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;

  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        resolved.hash = "";
        links.push(resolved.toString());
      }
    } catch {
      // Ignore unparseable hrefs (mailto:, javascript:, malformed, etc.)
    }
  });

  $(NOISE_SELECTORS.join(",")).remove();

  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return { title, text, links: Array.from(new Set(links)) };
}
