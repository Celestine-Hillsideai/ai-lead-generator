/**
 * Minimal robots.txt parser: enough to respect Disallow/Allow for a single
 * user-agent (our bot, falling back to "*"), per docs/spec.md §12, §23.
 * Not a full RFC 9309 implementation (no crawl-delay directive parsing here
 * -- crawl delay is a fixed config value in lib/scraper/crawler.ts instead).
 */

interface RobotsRule {
  path: string;
  allow: boolean;
}

export interface RobotsPolicy {
  rules: RobotsRule[];
  sitemaps: string[];
}

const EMPTY_POLICY: RobotsPolicy = { rules: [], sitemaps: [] };

export function parseRobotsTxt(content: string, userAgent: string): RobotsPolicy {
  const lines = content.split(/\r?\n/);
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let currentGroup: { agents: string[]; rules: RobotsRule[] } | null = null;
  const sitemaps: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0]?.trim();
    if (!line) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const field = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (field === "user-agent") {
      if (!currentGroup || currentGroup.rules.length > 0) {
        currentGroup = { agents: [value], rules: [] };
        groups.push(currentGroup);
      } else {
        currentGroup.agents.push(value);
      }
    } else if (field === "disallow" && currentGroup) {
      if (value !== "") currentGroup.rules.push({ path: value, allow: false });
    } else if (field === "allow" && currentGroup) {
      if (value !== "") currentGroup.rules.push({ path: value, allow: true });
    } else if (field === "sitemap") {
      sitemaps.push(value);
    }
  }

  const exactMatch = groups.find((g) =>
    g.agents.some((a) => a.toLowerCase() === userAgent.toLowerCase())
  );
  const wildcardMatch = groups.find((g) => g.agents.includes("*"));
  const chosen = exactMatch ?? wildcardMatch ?? null;

  return { rules: chosen?.rules ?? EMPTY_POLICY.rules, sitemaps };
}

/** Longest-matching-rule wins, per the de facto robots.txt convention. */
export function isPathAllowed(policy: RobotsPolicy, path: string): boolean {
  let best: RobotsRule | null = null;
  for (const rule of policy.rules) {
    if (path.startsWith(rule.path) && (!best || rule.path.length > best.path.length)) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}
