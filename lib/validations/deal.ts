import { z } from "zod";

/**
 * Deal form validation (Phase 8). One Zod schema per wizard step so a step
 * can't advance with invalid data, plus a combined submit schema. Optional
 * fields accept empty string / null from the form and normalize to null.
 */

const optionalString = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((v) => (v && v.length ? v : null))
  .nullable();

const representing = z.enum(["buyer", "seller", "dual"]);

/** Non-negative integer day count (audit F-082 — number, not free text). */
const contingencyDays = z
  .number({ message: "Enter a number of days." })
  .int("Days must be a whole number.")
  .min(0, "Days can't be negative.")
  .max(365, "That seems too long.")
  .nullable()
  .optional();

// ── Step 2: property & client ─────────────────────────────────────────────────
export const dealStep2Schema = z.object({
  property_address: z
    .string()
    .trim()
    .min(1, "Property address is required.")
    .max(200),
  property_city: optionalString,
  property_state: z
    .string()
    .trim()
    .max(2, "Use the 2-letter state code.")
    .optional()
    .transform((v) => (v && v.length ? v.toUpperCase() : null))
    .nullable(),
  property_zip: optionalString,
  client_first_name: z
    .string()
    .trim()
    .min(1, "Client first name is required.")
    .max(80),
  client_last_name: z
    .string()
    .trim()
    .min(1, "Client last name is required.")
    .max(80),
  client_email: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length ? v.toLowerCase() : null))
    .nullable(),
  client_phone: optionalString,
  representing,
});
export type DealStep2 = z.infer<typeof dealStep2Schema>;

// ── Step 3: deal terms ────────────────────────────────────────────────────────
export const dealStep3Schema = z.object({
  // RPA signed date anchors all contingency math (audit SR-7) — required.
  rpa_signed_date: z.string().trim().min(1, "RPA signed date is required."),
  sales_price_cents: z
    .number()
    .int()
    .min(0, "Price can't be negative.")
    .nullable()
    .optional(),
  // Real-estate commissions are decimals (2.5%, 2.75%). DB is NUMERIC(5,3), so
  // allow up to 3 decimal places (audit Bug 2).
  commission_pct: z
    .number()
    .min(0, "Can't be negative.")
    .max(100, "Over 100%?")
    .multipleOf(0.001, "Up to 3 decimal places.")
    .nullable()
    .optional(),
  gci_cents: z.number().int().min(0).nullable().optional(),
  inspection_contingency_days: contingencyDays,
  appraisal_contingency_days: contingencyDays,
  loan_contingency_days: contingencyDays,
  close_date: optionalString,
  // Conditional by `representing` — all optional at the schema level; the UI
  // shows/hides them (F-081).
  listing_agent_id: z.string().uuid().nullable().optional(),
  co_listing_agent_id: z.string().uuid().nullable().optional(),
  buyer_agent_id: z.string().uuid().nullable().optional(),
  listing_broker: optionalString,
  buy_side_broker: optionalString,
  deal_type_id: z.string().uuid().nullable().optional(),
});
export type DealStep3 = z.infer<typeof dealStep3Schema>;

/** Combined payload validated on final submit. */
export const dealSubmitSchema = dealStep2Schema.extend(dealStep3Schema.shape);
export type DealSubmit = z.infer<typeof dealSubmitSchema>;

/** Partial schema used by inline edits on the detail page. */
export const dealPatchSchema = dealSubmitSchema.partial();
export type DealPatch = z.infer<typeof dealPatchSchema>;

export const dealCommentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment.").max(4000),
  parentId: z.string().uuid().nullable().optional(),
});
