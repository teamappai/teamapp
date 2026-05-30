import "server-only";
import OpenAI from "openai";
import { buildDocumentPart, pngImagePart } from "./content";
import { renderPdfToPngs, MAX_PDF_PAGES } from "./pdf";
import {
  ExtractionError,
  LOW_CONFIDENCE_THRESHOLD,
  MAX_FILE_BYTES,
  type AIProvider,
  type ExtractedFields,
  type ExtractionResult,
  type FieldConfidence,
} from "./types";

/**
 * OpenAI contract-extraction provider (Phase 8). Uses gpt-4o with structured
 * outputs (JSON schema, strict) at temperature 0 for determinism.
 *
 * Conservative by design (SR-1): the model is told to return null rather than
 * guess, and to score its own confidence per field. Callers never auto-apply
 * these values — the UI requires explicit per-field confirmation.
 */

const MODEL = "gpt-4o";
const MAX_OUTPUT_TOKENS = 2000;
const TIMEOUT_MS = 60_000;

// strict JSON-schema requires every property to be listed in `required` and
// `additionalProperties: false`. Nullable fields use a ["type","null"] union.
const nullableString = { type: ["string", "null"] } as const;
const nullableInteger = { type: ["integer", "null"] } as const;

const FIELD_KEYS = [
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
] as const;

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    fields: {
      type: "object",
      additionalProperties: false,
      properties: {
        client_first_name: nullableString,
        client_last_name: nullableString,
        client_email: nullableString,
        client_phone: nullableString,
        property_address: nullableString,
        property_city: nullableString,
        property_state: {
          type: ["string", "null"],
          description: "2-letter state code",
        },
        property_zip: nullableString,
        sales_price_cents: {
          type: ["integer", "null"],
          description:
            "Sales price in integer CENTS (dollars × 100), not dollars",
        },
        rpa_signed_date: {
          type: ["string", "null"],
          description: "ISO date YYYY-MM-DD",
        },
        inspection_contingency_days: nullableInteger,
        appraisal_contingency_days: nullableInteger,
        loan_contingency_days: nullableInteger,
        close_date: {
          type: ["string", "null"],
          description: "ISO date YYYY-MM-DD",
        },
        representing: {
          type: ["string", "null"],
          enum: ["buyer", "seller", "dual", null],
        },
      },
      required: [...FIELD_KEYS],
    },
    confidence: {
      type: "object",
      additionalProperties: false,
      description:
        "Per-field confidence in [0,1]. Use a low value when unsure.",
      properties: Object.fromEntries(
        FIELD_KEYS.map((k) => [k, { type: "number" }]),
      ),
      required: [...FIELD_KEYS],
    },
  },
  required: ["fields", "confidence"],
} as const;

const SYSTEM_PROMPT = `You extract structured data from US residential real-estate purchase contracts (RPAs) and related documents.

Rules:
- Extract ONLY values that are explicitly present in the document. If a value is not clearly stated, return null — never guess or infer.
- sales_price_cents MUST be an integer in CENTS (multiply the dollar amount by 100). Example: $650,000 -> 65000000.
- Dates MUST be ISO format YYYY-MM-DD.
- property_state MUST be the 2-letter postal code (e.g. CA).
- Contingency periods are integer numbers of DAYS.
- representing is the side our agent represents: "buyer", "seller", or "dual". Return null if unclear.
- For every field, also return a confidence score in [0,1]. Be honest and conservative — when a value is ambiguous or you are inferring, score it low (< 0.7).`;

function coerceFields(raw: unknown): ExtractedFields {
  const f = (raw as { fields?: Record<string, unknown> })?.fields ?? {};
  const str = (v: unknown) =>
    typeof v === "string" && v.trim() ? v.trim() : null;
  const int = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
  const rep = f.representing;
  return {
    client_first_name: str(f.client_first_name),
    client_last_name: str(f.client_last_name),
    client_email: str(f.client_email),
    client_phone: str(f.client_phone),
    property_address: str(f.property_address),
    property_city: str(f.property_city),
    property_state: str(f.property_state)?.toUpperCase().slice(0, 2) ?? null,
    property_zip: str(f.property_zip),
    sales_price_cents: int(f.sales_price_cents),
    rpa_signed_date: str(f.rpa_signed_date),
    inspection_contingency_days: int(f.inspection_contingency_days),
    appraisal_contingency_days: int(f.appraisal_contingency_days),
    loan_contingency_days: int(f.loan_contingency_days),
    close_date: str(f.close_date),
    representing:
      rep === "buyer" || rep === "seller" || rep === "dual" ? rep : null,
  };
}

function coerceConfidence(raw: unknown): FieldConfidence {
  const c = (raw as { confidence?: Record<string, unknown> })?.confidence ?? {};
  const out: FieldConfidence = {};
  for (const key of FIELD_KEYS) {
    const v = c[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = Math.max(0, Math.min(1, v));
    }
  }
  return out;
}

const USER_PROMPT =
  "Extract the deal fields from the attached contract document. Return null for anything not explicitly stated in the document. Do NOT invent or guess values.";

export class OpenAIProvider implements AIProvider {
  async extract(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<ExtractionResult> {
    // Guard: never call the model with an empty document (SR-1 hallucination
    // protection — a documentless request invents plausible fake data).
    if (!fileBuffer || fileBuffer.byteLength === 0) {
      throw new ExtractionError(
        "Cannot extract from empty input.",
        "no_document",
      );
    }
    if (fileBuffer.byteLength > MAX_FILE_BYTES) {
      throw new ExtractionError(
        "Please upload contracts under 10MB.",
        "too_large",
      );
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ExtractionError(
        "AI extraction is not configured. Please enter details manually.",
        "no_api_key",
      );
    }

    // Build the document content parts.
    //  - images  → a single high-detail image_url part
    //  - PDFs     → rasterized to one high-DPI PNG per page (flattened e-signed
    //               contracts have no text layer; PNG vision is the reliable
    //               input). PDFs ALWAYS go through PNG conversion now.
    let documentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[];
    let logSuffix: string;

    if (mimeType.startsWith("image/")) {
      const part = buildDocumentPart(fileBuffer, mimeType);
      if (!part) {
        throw new ExtractionError(
          "Unsupported file type. Upload a PDF or image of the contract.",
          "unsupported_type",
        );
      }
      documentParts = [part];
      logSuffix =
        `mime:${mimeType} source-bytes:${fileBuffer.byteLength} pages:1 ` +
        `converted-png-bytes:0 content:[text, image_url x 1] (base64 redacted)`;
    } else if (mimeType === "application/pdf") {
      let rendered;
      try {
        rendered = await renderPdfToPngs(fileBuffer);
      } catch (convErr) {
        console.error(
          "[ai] pdf->png conversion failed:",
          convErr instanceof Error ? convErr.message : convErr,
        );
        throw new ExtractionError(
          "Couldn't process this PDF. Please try a different file or enter details manually.",
          "pdf_conversion_failed",
        );
      }
      if (rendered.truncated) {
        console.warn(
          `[ai] PDF has ${rendered.totalPages} pages; only the first ${MAX_PDF_PAGES} were sent for extraction.`,
        );
      }
      documentParts = rendered.pages.map((p) => pngImagePart(p));
      const pngBytes = rendered.pages.reduce((n, p) => n + p.byteLength, 0);
      logSuffix =
        `mime:application/pdf source-bytes:${fileBuffer.byteLength} ` +
        `pages:${rendered.pages.length} converted-png-bytes:${pngBytes} ` +
        `content:[text, image_url x ${documentParts.length}] (base64 redacted)`;
    } else {
      throw new ExtractionError(
        "Unsupported file type. Upload a PDF or image of the contract.",
        "unsupported_type",
      );
    }

    // Defensive: never call the model with no document attached (SR-1).
    if (documentParts.length === 0) {
      throw new ExtractionError(
        "No document attached to extraction request.",
        "no_document",
      );
    }

    // Log the exact request structure (base64 REDACTED) so the OpenAI dashboard
    // and server logs can be cross-checked: the document MUST be present here.
    console.log(`[ai] openai ${MODEL} request — ${logSuffix}`);

    const client = new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });

    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "contract_extraction",
            strict: true,
            schema: EXTRACTION_SCHEMA,
          },
        },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [{ type: "text", text: USER_PROMPT }, ...documentParts],
          },
        ],
      });

      const usage = completion.usage;
      // Cost monitoring during dev (per spec).
      console.log(
        `[ai] openai ${MODEL} extraction tokens — in:${usage?.prompt_tokens ?? "?"} out:${usage?.completion_tokens ?? "?"}`,
      );

      const text = completion.choices[0]?.message?.content;
      if (!text) {
        throw new ExtractionError(
          "AI extraction failed. Please enter details manually.",
        );
      }
      const parsed = JSON.parse(text) as unknown;

      return {
        fields: coerceFields(parsed),
        confidence: coerceConfidence(parsed),
        modelName: MODEL,
        raw: parsed,
        documentAttached: true,
        usage: {
          inputTokens: usage?.prompt_tokens,
          outputTokens: usage?.completion_tokens,
        },
      };
    } catch (err) {
      if (err instanceof ExtractionError) throw err;
      const message =
        err instanceof Error ? err.message : "Unknown extraction error";
      console.error("[ai] openai extraction error:", message);
      throw new ExtractionError(
        "AI extraction failed. Please enter details manually.",
      );
    }
  }
}

export { LOW_CONFIDENCE_THRESHOLD };
