import { describe, expect, it } from "vitest";
import { extractPage } from "../../lib/scraper/extract";

describe("extractPage", () => {
  it("extracts the title and visible text, stripping script/style/nav/footer", () => {
    const html = `
      <html>
        <head><title>Acme Logistics -- About Us</title></head>
        <body>
          <nav>Home | About | Contact</nav>
          <script>trackPageView();</script>
          <style>.hero { color: red; }</style>
          <main>
            <h1>We move freight across West Africa.</h1>
            <p>Founded in 2015, Acme Logistics expanded into Ghana in 2024.</p>
          </main>
          <footer>&copy; 2026 Acme Logistics</footer>
        </body>
      </html>
    `;

    const result = extractPage(html, "https://acme-logistics.example.com/about");

    expect(result.title).toBe("Acme Logistics -- About Us");
    expect(result.text).toContain("We move freight across West Africa.");
    expect(result.text).toContain("Founded in 2015");
    expect(result.text).not.toContain("trackPageView");
    expect(result.text).not.toContain("Home | About | Contact");
    expect(result.text).not.toContain("2026 Acme Logistics");
  });

  it("resolves relative links against the base URL and dedupes them", () => {
    const html = `
      <body>
        <a href="/about">About</a>
        <a href="/about">About again</a>
        <a href="https://acme-logistics.example.com/contact">Contact</a>
        <a href="mailto:hello@example.com">Email us</a>
        <a href="javascript:void(0)">JS link</a>
      </body>
    `;

    const result = extractPage(html, "https://acme-logistics.example.com/");

    expect(result.links).toContain("https://acme-logistics.example.com/about");
    expect(result.links).toContain("https://acme-logistics.example.com/contact");
    expect(result.links).not.toContain("mailto:hello@example.com");
    expect(result.links.filter((l) => l.includes("/about")).length).toBe(1);
  });

  it("returns a null title when there is none", () => {
    const result = extractPage("<body><p>No title here</p></body>", "https://example.com/");
    expect(result.title).toBeNull();
  });
});
