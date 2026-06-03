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
    // Unit tests are co-located as *.test.ts. Playwright E2E specs live in
    // tests/ as *.spec.ts — keep vitest from picking those up.
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "tests/**", ".next/**"],
  },
});
