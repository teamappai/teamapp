/**
 * AI contract-extraction abstraction (Phase 8, audit SR-1).
 *
 * The provider boundary exists so a future Anthropic fallback can be added
 * without touching callers (playbook: "AI: OpenAI primary, Anthropic optional
 * fallback"). Callers use `extractContract` from `./index`; concrete providers
 * implement {@link AIProvider}.
 *
 * IMPORTANT (SR-1): the current extraction was wrong in 100% of tested cases,
 * so extraction output is treated as *suggestions only*. The UI requires
 * explicit per-field confirmation and greys out low-confidence values; nothing
 * here is ever auto-applied to a deal.
 */

/** The fields we attempt to extract. Mirrors the `deals` table columns. */
export type ExtractedFields = {
  client_first_name: string | null;
  client_last_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null; // 2-letter code
  property_zip: string | null;
  sales_price_cents: number | null; // integer cents, NOT dollars
  rpa_signed_date: string | null; // YYYY-MM-DD
  inspection_contingency_days: number | null;
  appraisal_contingency_days: number | null;
  loan_contingency_days: number | null;
  close_date: string | null; // YYYY-MM-DD
  representing: "buyer" | "seller" | "dual" | null;
};

/** The field keys, useful for iterating UI pills. */
export const EXTRACTED_FIELD_KEYS = [
  "client_first_name",
  "client_last_name",
  "client_email",
  "client_phone",
  "property_address",
  "property_city",
  "property_state",
  "property_zip",
  "sales_price_cents",
  "rpa_signed_date",
  "inspection_contingency_days",
  "appraisal_contingency_days",
  "loan_contingency_days",
  "close_date",
  "representing",
] as const satisfies readonly (keyof ExtractedFields)[];

export type ExtractedFieldKey = (typeof EXTRACTED_FIELD_KEYS)[number];

/**
 * Per-field confidence in [0, 1] when the model returns it. Fields below
 * {@link LOW_CONFIDENCE_THRESHOLD} are rendered greyed-out and must be edited
 * or explicitly confirmed before use.
 */
export type FieldConfidence = Partial<Record<ExtractedFieldKey, number>>;

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export type ExtractionResult = {
  fields: ExtractedFields;
  confidence: FieldConfidence;
  modelName: string;
  /** The raw provider response, persisted to deal_ai_extractions for audit. */
  raw: unknown;
  /**
   * True only when a document (PDF/image) content part was actually attached to
   * the model request. The provider guarantees this is true on success — it is
   * surfaced so callers can defensively reject any response that came from a
   * documentless request (the SR-1 hallucination guard).
   */
  documentAttached: boolean;
  usage?: { inputTokens?: number; outputTokens?: number };
};

export interface AIProvider {
  extract(fileBuffer: Buffer, mimeType: string): Promise<ExtractionResult>;
}

/** Thrown by providers (and surfaced to callers) when extraction can't run. */
export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "too_large"
      | "no_api_key"
      | "unsupported_type"
      | "no_document"
      | "pdf_conversion_failed"
      | "provider_error"
      | "not_implemented" = "provider_error",
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** Hard cap before we even call the model (cost guard). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
