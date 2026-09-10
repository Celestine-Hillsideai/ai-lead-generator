import { assertPublicHttpUrl } from "../security/ssrf";

/**
 * SSRF-safe HTTP fetch with a timeout and a response-size cap, per
 * docs/spec.md §12, §23. Every call validates the URL (and, for DNS names,
 * the resolved IP) before fetching -- callers should never call the global
 * `fetch` directly for anything crawler-related.
 */

export interface FetchPageOptions {
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
}

export interface FetchPageResult {
  url: string;
  status: number;
  contentType: string | null;
  body: string;
  truncated: boolean;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000; // 2MB -- generous for a marketing/company page, caps pathological responses
const DEFAULT_USER_AGENT = "AI-Lead-Generator-Research-Bot/1.0 (+https://github.com/)";

export async function fetchPage(
  urlString: string,
  options: FetchPageOptions = {}
): Promise<FetchPageResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, userAgent = DEFAULT_USER_AGENT } =
    options;

  // Throws SsrfBlockedError if unsafe -- let it propagate, callers decide
  // how to record the failure (per-company/per-page isolation happens above
  // this layer).
  const validatedUrl = await assertPublicHttpUrl(urlString);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(validatedUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": userAgent },
    });

    const contentType = response.headers.get("content-type");

    if (!response.body) {
      return { url: validatedUrl.toString(), status: response.status, contentType, body: "", truncated: false };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    let truncated = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > maxBytes) {
          truncated = true;
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }

    const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf-8");

    return { url: validatedUrl.toString(), status: response.status, contentType, body, truncated };
  } finally {
    clearTimeout(timeout);
  }
}
