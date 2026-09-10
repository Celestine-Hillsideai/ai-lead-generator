/**
 * Standalone CSV validator matching the lead-import contract (docs/spec.md
 * §11): required columns company_name, website; optional industry, location,
 * notes. Runs independently of the app so imports can be checked before any
 * UI exists.
 *
 * Usage: npx tsx tools/validate-csv.ts <path-to-csv>
 * (needs tsx/ts-node once package.json exists; no other app dependencies)
 */

import { readFileSync } from "node:fs";

const REQUIRED_COLUMNS = ["company_name", "website"] as const;
const OPTIONAL_COLUMNS = ["industry", "location", "notes"] as const;
const KNOWN_COLUMNS = new Set<string>([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);

interface ValidationResult {
  row: number;
  status: "accepted" | "rejected" | "duplicate" | "invalid";
  reason?: string;
  data?: Record<string, string>;
}

function parseCsvLine(line: string): string[] {
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

function normalizeDomain(rawUrl: string): string | null {
  try {
    const withProtocol = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    const url = new URL(withProtocol);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

function validateCsv(filePath: string): ValidationResult[] {
  const raw = readFileSync(filePath, "utf-8");
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
  if (unknownColumns.length > 0) {
    console.warn(`Warning: unrecognized column(s) will be ignored: ${unknownColumns.join(", ")}`);
  }

  const results: ValidationResult[] = [];
  const seenDomains = new Set<string>();

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
      continue;
    }

    const domain = normalizeDomain(website);
    if (!domain) {
      results.push({ row: rowNum, status: "invalid", reason: `Could not parse website as a URL: "${website}"` });
      continue;
    }

    if (seenDomains.has(domain)) {
      results.push({ row: rowNum, status: "duplicate", reason: `Duplicate normalized domain: ${domain}` });
      continue;
    }

    seenDomains.add(domain);
    results.push({
      row: rowNum,
      status: "accepted",
      data: { ...record, normalizedDomain: domain },
    });
  }

  return results;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx tools/validate-csv.ts <path-to-csv>");
    process.exit(1);
  }

  const results = validateCsv(filePath);

  const counts = { accepted: 0, rejected: 0, duplicate: 0, invalid: 0 };
  for (const r of results) counts[r.status]++;

  for (const r of results) {
    if (r.status === "accepted") continue;
    console.log(`Row ${r.row}: ${r.status.toUpperCase()} - ${r.reason}`);
  }

  console.log("\nImport stats:", counts);
}

main();

export { validateCsv, normalizeDomain, parseCsvLine };
