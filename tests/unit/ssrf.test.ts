import { describe, expect, it, vi, beforeEach } from "vitest";

const lookupMock = vi.fn();

vi.mock("node:dns", () => ({
  default: {
    promises: {
      lookup: (...args: unknown[]) => lookupMock(...args),
    },
  },
}));

// Imported after the mock so it picks up the mocked module.
const { assertPublicHttpUrl, SsrfBlockedError } = await import("../../lib/security/ssrf");

describe("assertPublicHttpUrl", () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  it("rejects non-http(s) protocols", async () => {
    await expect(assertPublicHttpUrl("file:///etc/passwd")).rejects.toThrow(SsrfBlockedError);
    await expect(assertPublicHttpUrl("ftp://example.com")).rejects.toThrow(SsrfBlockedError);
  });

  it("rejects an invalid URL", async () => {
    await expect(assertPublicHttpUrl("not a url")).rejects.toThrow(SsrfBlockedError);
  });

  it('rejects "localhost" directly, without a DNS lookup', async () => {
    await expect(assertPublicHttpUrl("http://localhost:3000/admin")).rejects.toThrow(SsrfBlockedError);
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/", // cloud metadata endpoint
    "http://0.0.0.0/",
  ])("rejects blocked IPv4 literal %s", async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toThrow(SsrfBlockedError);
  });

  it("rejects the IPv6 loopback literal", async () => {
    await expect(assertPublicHttpUrl("http://[::1]/")).rejects.toThrow(SsrfBlockedError);
  });

  it("rejects a hostname that resolves to a private IP (DNS-rebinding-style)", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
    await expect(assertPublicHttpUrl("http://internal.example.com/")).rejects.toThrow(SsrfBlockedError);
  });

  it("accepts a hostname that resolves to a public IP", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
    const url = await assertPublicHttpUrl("https://example.com/about");
    expect(url.hostname).toBe("example.com");
  });

  it("rejects when the hostname fails to resolve", async () => {
    lookupMock.mockResolvedValueOnce([]);
    await expect(assertPublicHttpUrl("http://nonexistent.example.invalid/")).rejects.toThrow(SsrfBlockedError);
  });
});
