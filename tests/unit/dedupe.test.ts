import { describe, expect, it } from "vitest";
import { dedupeByDomain } from "../../lib/leads/dedupe";

describe("dedupeByDomain", () => {
  it("filters out candidates already in existingDomains", () => {
    const { toInsert, duplicateCount } = dedupeByDomain(
      [{ normalizedDomain: "acme.com" }, { normalizedDomain: "beta.com" }],
      new Set(["acme.com"])
    );
    expect(toInsert.map((c) => c.normalizedDomain)).toEqual(["beta.com"]);
    expect(duplicateCount).toBe(1);
  });

  it("keeps only the first of two candidates sharing a domain within the same batch", () => {
    const { toInsert, duplicateCount } = dedupeByDomain(
      [
        { normalizedDomain: "acme.com", label: "first" },
        { normalizedDomain: "acme.com", label: "second" },
      ],
      new Set()
    );
    expect(toInsert).toHaveLength(1);
    expect(toInsert[0]!.label).toBe("first");
    expect(duplicateCount).toBe(1);
  });

  it("returns everything when nothing is duplicated", () => {
    const { toInsert, duplicateCount } = dedupeByDomain(
      [{ normalizedDomain: "a.com" }, { normalizedDomain: "b.com" }],
      new Set()
    );
    expect(toInsert).toHaveLength(2);
    expect(duplicateCount).toBe(0);
  });
});
