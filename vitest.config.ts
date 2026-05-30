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
});
