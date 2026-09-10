import { describe, expect, it } from "vitest";
import { normalizeDomain, validateCsvContent } from "../../lib/validation/csv";

describe("normalizeDomain", () => {
  it("strips protocol and www, lowercases", () => {
    expect(normalizeDomain("https://www.Example.com/path")).toBe("example.com");
    expect(normalizeDomain("example.com")).toBe("example.com");
    expect(normalizeDomain("http://EXAMPLE.COM")).toBe("example.com");
  });

  it("returns null for unparseable input", () => {
    expect(normalizeDomain("not a url at all !!")).toBeNull();
  });
});

describe("validateCsvContent", () => {
  it("throws on missing required columns", () => {
    expect(() => validateCsvContent("industry,location\nLogistics,Lagos\n")).toThrow(/Missing required column/);
  });

  it("accepts valid rows and reports stats", () => {
    const csv = "company_name,website\nAcme,https://acme.example.com\nBeta,beta.example.com\n";
    const { results, stats } = validateCsvContent(csv);
    expect(stats.accepted).toBe(2);
    expect(results[0]!.status).toBe("accepted");
    expect(results[0]!.data!.normalizedDomain).toBe("acme.example.com");
  });

  it("flags rows missing required fields as invalid", () => {
    const csv = "company_name,website\nAcme,\n,https://beta.example.com\n";
    const { stats } = validateCsvContent(csv);
    expect(stats.invalid).toBe(2);
  });

  it("flags an unparseable website as invalid", () => {
    const csv = 'company_name,website\nAcme,"not a url !!"\n';
    const { stats } = validateCsvContent(csv);
    expect(stats.invalid).toBe(1);
  });

  it("flags duplicate normalized domains within the file", () => {
    const csv = "company_name,website\nAcme,https://acme.example.com\nAcme Inc,https://www.acme.example.com\n";
    const { stats, results } = validateCsvContent(csv);
    expect(stats.accepted).toBe(1);
    expect(stats.duplicate).toBe(1);
    expect(results[1]!.status).toBe("duplicate");
  });

  it("carries optional columns through when present", () => {
    const csv = "company_name,website,industry,location,notes\nAcme,acme.example.com,Logistics,Lagos,VIP lead\n";
    const { results } = validateCsvContent(csv);
    expect(results[0]!.data).toMatchObject({ industry: "Logistics", location: "Lagos", notes: "VIP lead" });
  });

  it("reports unrecognized columns without failing", () => {
    const csv = "company_name,website,unexpected_col\nAcme,acme.example.com,x\n";
    const { unknownColumns, stats } = validateCsvContent(csv);
    expect(unknownColumns).toEqual(["unexpected_col"]);
    expect(stats.accepted).toBe(1);
  });

  it("throws on an empty file", () => {
    expect(() => validateCsvContent("")).toThrow(/empty/);
  });
});
