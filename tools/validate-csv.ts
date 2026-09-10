/**
 * CLI wrapper around lib/validation/csv.ts -- checks a lead-import CSV
 * against the contract in docs/spec.md §11 without going through the UI.
 *
 * Usage: npx tsx tools/validate-csv.ts <path-to-csv>
 */

import { readFileSync } from "node:fs";
import { validateCsvContent } from "../lib/validation/csv";

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx tools/validate-csv.ts <path-to-csv>");
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf-8");
  const { results, stats, unknownColumns } = validateCsvContent(raw);

  if (unknownColumns.length > 0) {
    console.warn(`Warning: unrecognized column(s) will be ignored: ${unknownColumns.join(", ")}`);
  }

  for (const r of results) {
    if (r.status === "accepted") continue;
    console.log(`Row ${r.row}: ${r.status.toUpperCase()} - ${r.reason}`);
  }

  console.log("\nImport stats:", stats);
}

main();
