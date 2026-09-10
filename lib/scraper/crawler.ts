import { fetchPage } from "./fetcher";
import { extractPage, type ExtractedPage } from "./extract";
import { parseRobotsTxt, isPathAllowed, type RobotsPolicy } from "./robots";
import { discoverSitemapUrls } from "./sitemap";

/**
 * Bounded crawler for the Website Research Agent, per docs/spec.md §12:
 * fetch homepage first, discover sitemap, prioritize target page types,
 * default max 15 pages/company, dedup URLs, isolate per-page failures.
 */

const PRIORITY_KEYWORDS = [
  "about",
  "service",
  "product",
  "solution",
  "industr",
  "leadership",
  "team",
  "career",
  "news",
  "blog",
  "contact",
];

export interface CrawledPage {
  url: string;
  title: string | null;
  text: string;
}

export interface CrawlResult {
  pages: CrawledPage[];
  failedUrls: { url: string; reason: string }[];
}

export interface CrawlOptions {
  maxPages?: number;
  concurrency?: number;
  crawlDelayMs?: number;
  userAgent?: string;
}

const DEFAULT_MAX_PAGES = 15;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_CRAWL_DELAY_MS = 250;
const DEFAULT_USER_AGENT = "AI-Lead-Generator-Research-Bot/1.0 (+https://github.com/)";

function priorityScore(url: string): number {
  const lower = url.toLowerCase();
  const index = PRIORITY_KEYWORDS.findIndex((kw) => lower.includes(kw));
  return index === -1 ? PRIORITY_KEYWORDS.length : index; // lower is higher priority
}

async function loadRobotsPolicy(baseUrl: string, userAgent: string): Promise<RobotsPolicy> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const result = await fetchPage(robotsUrl, { timeoutMs: 5_000, maxBytes: 200_000 });
    if (result.status !== 200) return { rules: [], sitemaps: [] };
    return parseRobotsTxt(result.body, userAgent);
  } catch {
    // No robots.txt (or it failed to fetch) means no restrictions declared.
    return { rules: [], sitemaps: [] };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Crawls a company's website within the given bounds. One failing page never
 * aborts the crawl -- it's recorded in `failedUrls` and skipped, per spec
 * §12 ("If a website fails, mark the company appropriately and allow other
 * companies to continue" -- the same isolation principle applied at the
 * page level here).
 */
/** Type alias for dependency injection (see trigger/research-workflow.ts's ProcessCompanyDeps). */
export type CrawlWebsiteFn = typeof crawlWebsite;

export async function crawlWebsite(startUrl: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const {
    maxPages = DEFAULT_MAX_PAGES,
    concurrency = DEFAULT_CONCURRENCY,
    crawlDelayMs = DEFAULT_CRAWL_DELAY_MS,
    userAgent = DEFAULT_USER_AGENT,
  } = options;

  const pages: CrawledPage[] = [];
  const failedUrls: CrawlResult["failedUrls"] = [];
  const visited = new Set<string>();

  const robotsPolicy = await loadRobotsPolicy(startUrl, userAgent);
  const sitemapUrls = await discoverSitemapUrls(startUrl, robotsPolicy.sitemaps);

  // Seed the queue with the homepage first (always fetched first, per spec
  // §12), then sitemap URLs ranked by how strongly they match a priority
  // page type -- links discovered while crawling are appended as we go.
  const queue: string[] = [startUrl, ...sitemapUrls.filter((u) => u !== startUrl)];
  queue.sort((a, b) => {
    if (a === startUrl) return -1;
    if (b === startUrl) return 1;
    return priorityScore(a) - priorityScore(b);
  });

  async function crawlOne(url: string): Promise<void> {
    let path: string;
    try {
      path = new URL(url).pathname;
    } catch {
      failedUrls.push({ url, reason: "Invalid URL" });
      return;
    }

    if (!isPathAllowed(robotsPolicy, path)) {
      failedUrls.push({ url, reason: "Disallowed by robots.txt" });
      return;
    }

    try {
      const result = await fetchPage(url, { userAgent });
      if (result.status < 200 || result.status >= 300) {
        failedUrls.push({ url, reason: `HTTP ${result.status}` });
        return;
      }

      const contentType = result.contentType ?? "";
      if (!contentType.includes("html")) {
        failedUrls.push({ url, reason: `Non-HTML content-type: ${contentType}` });
        return;
      }

      const extracted: ExtractedPage = extractPage(result.body, url);
      pages.push({ url: result.url, title: extracted.title, text: extracted.text });

      // Discovered links extend the queue (still bounded by maxPages/visited
      // dedup below), prioritized the same way as the seed queue.
      const newLinks = extracted.links
        .filter((link) => new URL(link).hostname === new URL(startUrl).hostname)
        .filter((link) => !visited.has(link) && !queue.includes(link));
      newLinks.sort((a, b) => priorityScore(a) - priorityScore(b));
      queue.push(...newLinks);
    } catch (err) {
      failedUrls.push({ url, reason: err instanceof Error ? err.message : "Unknown fetch error" });
    }
  }

  while (queue.length > 0 && visited.size < maxPages) {
    const batch: string[] = [];
    while (batch.length < concurrency && queue.length > 0 && visited.size + batch.length < maxPages) {
      const next = queue.shift();
      if (!next) break;
      if (visited.has(next)) continue;
      visited.add(next);
      batch.push(next);
    }
    if (batch.length === 0) break;

    await Promise.all(batch.map((url) => crawlOne(url)));

    if (queue.length > 0 && visited.size < maxPages) {
      await sleep(crawlDelayMs);
    }
  }

  return { pages, failedUrls };
}
