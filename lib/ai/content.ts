import type OpenAI from "openai";

type ContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

/**
 * Build the document content part for an OpenAI chat request — IMAGES ONLY.
 *
 * PDFs are NOT handled here anymore: flattened e-signed contracts have no text
 * layer, so the provider rasterizes every PDF page to a PNG first (see
 * `lib/ai/pdf.ts`) and sends those via {@link pngImagePart}. This helper returns
 * an image_url part for real image uploads, and null for anything else so the
 * provider refuses to call the model documentless (the SR-1 hallucination
 * guard).
 *
 * Pure (no `server-only`) so it is unit-testable.
 */
export function buildDocumentPart(
  fileBuffer: Buffer,
  mimeType: string,
): ContentPart | null {
  if (mimeType.startsWith("image/")) {
    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
    return { type: "image_url", image_url: { url: dataUrl, detail: "high" } };
  }
  // PDFs go through PNG conversion in the provider; unsupported types → null.
  return null;
}

/** An image_url content part for a rendered PNG page (high detail for OCR). */
export function pngImagePart(pngBuffer: Buffer): ContentPart {
  const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
  return { type: "image_url", image_url: { url: dataUrl, detail: "high" } };
}
