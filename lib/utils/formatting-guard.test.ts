import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, relative } from "node:path";

/**
 * CR-6 regression guard. All dates, money, and percentages must route through
 * the helpers in `lib/utils/format.ts`. This test scans the customer-facing
 * source trees (`/app`, `/components`) and FAILS the build if any ad-hoc
 * formatting pattern reappears.
 *
 * This file lives in `lib/utils/` (NOT under a scanned root) on purpose — so the
 * forbidden patterns it references as test data can't trip the scan itself.
 */

const ROOT = resolve(__dirname, "..", "..");
const SCAN_DIRS = ["app", "components"];
const EXT = /\.(ts|tsx)$/;
// Co-located test/spec helpers may legitimately contain these patterns as data.
const SKIP = /\.(test|spec)\.(ts|tsx)$/;

type Rule = { name: string; pattern: RegExp; hint: string };

const RULES: Rule[] = [
  {
    name: "bare-string currency",
    // A literal "$" immediately followed by a digit (e.g. "$0", "$1,200").
    pattern: /\$\d/,
    hint: "Use formatCurrency() — never hand-write a dollar amount.",
  },
  {
    name: "toLocaleDateString",
    pattern: /toLocaleDateString/,
    hint: "Use formatDate() instead.",
  },
  {
    name: "Date.toString()",
    // .toString() on an inline Date — not on numbers or URLSearchParams.
    pattern: /new Date\([^)]*\)\.toString\(\)/,
    hint: "Use formatDate() instead of stringifying a Date.",
  },
  {
    name: "raw float percentage",
    pattern: /(0|[1-9]\d*)\.\d{2,}%/,
    hint: "Use formatPercent() — percentages render as integers by default.",
  },
];

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (EXT.test(entry) && !SKIP.test(entry)) {
      out.push(full);
    }
  }
}

function scan(): string[] {
  const files: string[] = [];
  for (const d of SCAN_DIRS) walk(join(ROOT, d), files);
  return files;
}

describe("CR-6 formatting guard", () => {
  const files = scan();

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(RULES)("forbids $name in /app and /components", (rule) => {
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (rule.pattern.test(line)) {
          offenders.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      `Found ${rule.name} usage. ${rule.hint}\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
