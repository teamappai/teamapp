import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Vitest resolves the `@/` path alias the same way Next/TypeScript does (see
 * tsconfig `paths`), so test files and app code can share import styles.
 */
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    // Unit tests are co-located as *.test.ts (plus the vitest suite under
    // tests/posthog/). Playwright E2E specs live in tests/ as *.spec.ts — the
    // include pattern already skips those; we also exclude them explicitly so a
    // stray *.test.ts helper in a Playwright dir can't leak in.
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "tests/**/*.spec.ts", ".next/**"],
  },
});
