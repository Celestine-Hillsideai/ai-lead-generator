import dns from "node:dns";

/**
 * SSRF protection for the Website Research Agent's crawler, per
 * docs/spec.md §12, §23: "Reject localhost, loopback, link-local,
 * private-network, and other internal targets."
 *
 * Checking the hostname string alone is not enough -- a hostname can resolve
 * (including via DNS rebinding, where the response changes between check and
 * fetch) to a private IP even if the hostname itself looks public. This
 * module resolves the hostname and validates the actual IP(s) it points to.
 */

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) + n;
  }
  return result >>> 0;
}

function inIpv4Range(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range!);
  if (ipInt === null || rangeInt === null) return false;
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

// Private, loopback, link-local, CGNAT, and other non-public IPv4 ranges.
const BLOCKED_IPV4_RANGES = [
  "0.0.0.0/8", // "this" network
  "10.0.0.0/8", // private
  "100.64.0.0/10", // CGNAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local
  "172.16.0.0/12", // private
  "192.0.0.0/24", // IETF protocol assignments
  "192.0.2.0/24", // documentation (TEST-NET-1)
  "192.168.0.0/16", // private
  "198.18.0.0/15", // benchmarking
  "198.51.100.0/24", // documentation (TEST-NET-2)
  "203.0.113.0/24", // documentation (TEST-NET-3)
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved
  "255.255.255.255/32", // broadcast
];

function isBlockedIpv4(ip: string): boolean {
  return BLOCKED_IPV4_RANGES.some((range) => inIpv4Range(ip, range));
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === "::1") return true; // loopback
  if (normalized === "::") return true; // unspecified

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) -- unwrap and check the IPv4 rules.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]!);

  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true; // link-local fe80::/10
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local fc00::/7

  return false;
}

function isBlockedIp(ip: string, family: number): boolean {
  return family === 4 ? isBlockedIpv4(ip) : isBlockedIpv6(ip);
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Validates that a URL is safe to fetch: http(s) only, hostname is not a
 * literal blocked IP, and every address the hostname resolves to is public.
 * Throws SsrfBlockedError if not. Returns the parsed URL on success so
 * callers don't re-parse.
 */
export async function assertPublicHttpUrl(urlString: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new SsrfBlockedError(`Not a valid URL: ${urlString}`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new SsrfBlockedError(`Blocked protocol "${url.protocol}" for URL: ${urlString}`);
  }

  // URL.hostname wraps IPv6 literals in brackets (e.g. "[::1]") -- strip them
  // before comparing against bare address forms.
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  if (hostname.toLowerCase() === "localhost") {
    throw new SsrfBlockedError(`Blocked hostname "localhost" for URL: ${urlString}`);
  }

  // If the hostname is itself a literal IP, check it directly.
  const literalV4 = ipv4ToInt(hostname) !== null;
  if (literalV4 && isBlockedIpv4(hostname)) {
    throw new SsrfBlockedError(`Blocked IP literal "${hostname}" for URL: ${urlString}`);
  }
  if (hostname.includes(":") && isBlockedIpv6(hostname)) {
    throw new SsrfBlockedError(`Blocked IPv6 literal "${hostname}" for URL: ${urlString}`);
  }

  if (!literalV4 && !hostname.includes(":")) {
    // Hostname is a DNS name -- resolve and check every address it points
    // to. Known residual gap: lib/scraper/fetcher.ts's subsequent fetch()
    // call re-resolves DNS itself, so a hostname whose DNS record changes
    // between this check and the actual connection (DNS rebinding) is not
    // fully closed by this check alone. Acceptable for MVP scope given the
    // narrow window and that targets come from user-supplied CSV rows, not
    // untrusted third parties; closing it fully requires pinning the
    // validated IP through a custom connection dispatcher.
    const addresses = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) {
      throw new SsrfBlockedError(`Could not resolve hostname "${hostname}" for URL: ${urlString}`);
    }
    for (const { address, family } of addresses) {
      if (isBlockedIp(address, family)) {
        throw new SsrfBlockedError(
          `Hostname "${hostname}" resolves to blocked address ${address} for URL: ${urlString}`
        );
      }
    }
  }

  return url;
}
