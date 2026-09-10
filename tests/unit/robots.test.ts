import { describe, expect, it } from "vitest";
import { parseRobotsTxt, isPathAllowed } from "../../lib/scraper/robots";

describe("parseRobotsTxt + isPathAllowed", () => {
  it("applies rules for an exact user-agent match over the wildcard group", () => {
    const content = `
User-agent: *
Disallow: /

User-agent: AI-Lead-Generator-Research-Bot/1.0
Allow: /
Disallow: /admin
`;
    const policy = parseRobotsTxt(content, "AI-Lead-Generator-Research-Bot/1.0");
    expect(isPathAllowed(policy, "/about")).toBe(true);
    expect(isPathAllowed(policy, "/admin")).toBe(false);
  });

  it("falls back to the wildcard group when no exact match exists", () => {
    const content = `
User-agent: *
Disallow: /private
`;
    const policy = parseRobotsTxt(content, "AI-Lead-Generator-Research-Bot/1.0");
    expect(isPathAllowed(policy, "/private/data")).toBe(false);
    expect(isPathAllowed(policy, "/public")).toBe(true);
  });

  it("defaults to allowed when no rules match", () => {
    const policy = parseRobotsTxt("User-agent: *\n", "AI-Lead-Generator-Research-Bot/1.0");
    expect(isPathAllowed(policy, "/anything")).toBe(true);
  });

  it("longest matching rule wins (Allow can override a broader Disallow)", () => {
    const content = `
User-agent: *
Disallow: /docs
Allow: /docs/public
`;
    const policy = parseRobotsTxt(content, "AI-Lead-Generator-Research-Bot/1.0");
    expect(isPathAllowed(policy, "/docs/private")).toBe(false);
    expect(isPathAllowed(policy, "/docs/public/page")).toBe(true);
  });

  it("collects Sitemap directives regardless of which group they're in", () => {
    const content = `
Sitemap: https://example.com/sitemap.xml
User-agent: *
Disallow:
`;
    const policy = parseRobotsTxt(content, "AI-Lead-Generator-Research-Bot/1.0");
    expect(policy.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("ignores comments and blank lines", () => {
    const content = `
# This is a comment
User-agent: *
# another comment
Disallow: /secret
`;
    const policy = parseRobotsTxt(content, "AI-Lead-Generator-Research-Bot/1.0");
    expect(isPathAllowed(policy, "/secret")).toBe(false);
  });
});
