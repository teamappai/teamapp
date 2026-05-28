import { z } from "zod";

/**
 * Reserved company names that must never be stored as data (audit F-050).
 * These are filter sentinels / placeholders the UI uses to mean "no specific
 * company". A DB check constraint (companies_name_not_reserved_ck) is the
 * backstop; this validator rejects them at the app layer with a clear message.
 */
const RESERVED_COMPANY_NAMES = new Set(["all companies", "—", "-", ""]);

export function isReservedCompanyName(name: string): boolean {
  return RESERVED_COMPANY_NAMES.has(name.trim().toLowerCase());
}

export const companyNameSchema = z
  .string()
  .trim()
  .min(1, "Company name is required")
  .max(120, "Company name is too long")
  .refine((name) => !isReservedCompanyName(name), {
    message:
      '"All Companies" and placeholder dashes are not valid company names',
  });

export type CompanyNameInput = z.infer<typeof companyNameSchema>;
