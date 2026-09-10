import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

// The crawler target is a local test server (127.0.0.1), which the real
// SSRF guard correctly blocks (verified separately in tests/unit/ssrf.test.ts).
// Bypass it here so this suite exercises crawler behavior -- prioritization,
// maxPages bound, dedup, robots.txt compliance, per-page failure isolation --
// in isolation from the SSRF layer, against a real local HTTP server rather
// than the live internet.
vi.mock("../../lib/security/ssrf", () => ({
  assertPublicHttpUrl: async (urlString: string) => new URL(urlString),
}));

const { crawlWebsite } = await import("../../lib/scraper/crawler");

const PAGES: Record<string, { status: number; contentType: string; body: string }> = {
  "/": {
    status: 200,
    contentType: "text/html",
    body: `<html><head><title>Home</title></head><body>
      <a href="/about">About</a>
      <a href="/services">Services</a>
      <a href="/admin">Admin</a>
      <a href="/broken">Broken</a>
      <p>Welcome to Acme.</p>
    </body></html>`,
  },
  "/about": {
    status: 200,
    contentType: "text/html",
    body: `<html><head><title>About</title></head><body><p>Founded in 2015.</p></body></html>`,
  },
  "/services": {
    status: 200,
    contentType: "text/html",
    body: `<html><head><title>Services</title></head><body><p>We offer freight tracking.</p></body></html>`,
  },
  "/admin": {
    status: 200,
    contentType: "text/html",
    body: `<html><head><title>Admin</title></head><body><p>Secret admin panel.</p></body></html>`,
  },
  "/broken": {
    status: 500,
    contentType: "text/html",
    body: "Internal Server Error",
  },
  "/robots.txt": {
    status: 200,
    contentType: "text/plain",
    body: "User-agent: *\nDisallow: /admin\n",
  },
  "/sitemap.xml": {
    status: 404,
    contentType: "text/plain",
    body: "",
  },
};

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const page = PAGES[req.url ?? "/"];
    if (!page) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(page.status, { "content-type": page.contentType });
    res.end(page.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}/`;
});

afterAll(() => {
  server.close();
});

describe("crawlWebsite (against a local test server)", () => {
  it("crawls the homepage first, follows same-origin links, and isolates per-page failures", async () => {
    const result = await crawlWebsite(baseUrl, { maxPages: 10, crawlDelayMs: 0 });

    const urls = result.pages.map((p) => p.url);
    expect(urls[0]).toBe(baseUrl);
    expect(urls).toContain(baseUrl + "about");
    expect(urls).toContain(baseUrl + "services");

    // /broken returns HTTP 500 -- recorded as a failure, doesn't abort the crawl.
    expect(result.failedUrls.some((f) => f.url === baseUrl + "broken")).toBe(true);
    expect(result.pages.some((p) => p.url === baseUrl + "broken")).toBe(false);
  });

  it("respects robots.txt Disallow", async () => {
    const result = await crawlWebsite(baseUrl, { maxPages: 10, crawlDelayMs: 0 });

    expect(result.pages.some((p) => p.url === baseUrl + "admin")).toBe(false);
    expect(
      result.failedUrls.some((f) => f.url === baseUrl + "admin" && f.reason.includes("robots.txt"))
    ).toBe(true);
  });

  it("respects the maxPages bound", async () => {
    const result = await crawlWebsite(baseUrl, { maxPages: 2, crawlDelayMs: 0 });
    expect(result.pages.length).toBeLessThanOrEqual(2);
  });

  it("never visits the same URL twice", async () => {
    const result = await crawlWebsite(baseUrl, { maxPages: 10, crawlDelayMs: 0 });
    const urls = result.pages.map((p) => p.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
