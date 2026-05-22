import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Defense-in-depth for the server-only boundary: the service-role client
    // is also guarded at runtime by `import "server-only"`, but this catches
    // accidental imports into shared/layout/ui components at lint time.
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/supabase/service", "**/lib/supabase/service"],
              message:
                "The service-role Supabase client is server-only and must never be imported into components. Use @/lib/supabase/server in Server Components or Route Handlers instead.",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "types/supabase.ts",
    ],
  },
];

export default eslintConfig;
