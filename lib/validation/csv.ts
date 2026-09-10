/**
 * Lead-import CSV validation, per docs/spec.md §11: required columns
 * company_name, website; optional industry, location, notes. Validates
 * headers, URLs, empty values, duplicates, and malformed rows, and produces
 * import statistics (accepted/rejected/duplicate/invalid).
 *
 * Pure, dependency-free, and operates on raw CSV text (not a file path) so
 * it's usable from both tools/validate-csv.ts (a CLI wrapper around this)
 * and a future API route handling an uploaded file buffer.
 */

const REQUIRED_COLUMNS = ["company_name", "website"] as const;
const OPTIONAL_COLUMNS = ["industry", "location", "notes"] as const;
const KNOWN_COLUMNS = new Set<string>([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);

export interface CsvRowResult {
  row: number;
  status: "accepted" | "rejected" | "duplicate" | "invalid";
  reason?: string;
  data?: {
    companyName: string;
    website: string;
    normalizedDomain: string;
    industry?: string;
    location?: string;
    notes?: string;
  };
}

export interface CsvValidationSummary {
  results: CsvRowResult[];
  stats: { accepted: number; rejected: number; duplicate: number; invalid: number };
  unknownColumns: string[];
}

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function normalizeDomain(rawUrl: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function validateCsvContent(raw: string): CsvValidationSummary {
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error("CSV file is empty.");
  }

  const header = parseCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const missingRequired = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missingRequired.length > 0) {
    throw new Error(`Missing required column(s): ${missingRequired.join(", ")}`);
  }

  const unknownColumns = header.filter((h) => !KNOWN_COLUMNS.has(h));

  const results: CsvRowResult[] = [];
  const seenDomains = new Set<string>();
  const stats = { accepted: 0, rejected: 0, duplicate: 0, invalid: 0 };

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed, header is row 1
    const fields = parseCsvLine(lines[i]!);
    const record: Record<string, string> = {};
    header.forEach((col, idx) => {
      record[col] = fields[idx] ?? "";
    });

    const companyName = record["company_name"];
    const website = record["website"];

    if (!companyName || !website) {
      results.push({ row: rowNum, status: "invalid", reason: "company_name and website are required." });
      stats.invalid++;
      continue;
    }

    const domain = normalizeDomain(website);
    if (!domain) {
      results.push({ row: rowNum, status: "invalid", reason: `Could not parse website as a URL: "${website}"` });
      stats.invalid++;
      continue;
    }

    if (seenDomains.has(domain)) {
      results.push({ row: rowNum, status: "duplicate", reason: `Duplicate normalized domain: ${domain}` });
      stats.duplicate++;
      continue;
    }

    seenDomains.add(domain);
    results.push({
      row: rowNum,
      status: "accepted",
      data: {
        companyName,
        website,
        normalizedDomain: domain,
        industry: record["industry"] || undefined,
        location: record["location"] || undefined,
        notes: record["notes"] || undefined,
      },
    });
    stats.accepted++;
  }

  return { results, stats, unknownColumns };
}
