import type OpenAI from "openai";

type ContentPart = OpenAI.Chat.Completions.ChatCompletionContentPart;

/**
 * Build the document content part for an OpenAI chat request — IMAGES ONLY.
 *
 * PDFs are NOT handled here: the provider sends them directly to OpenAI as a
 * base64 `file` part (OpenAI extracts the text layer and renders each page
 * server-side). This helper returns an image_url part for real image uploads,
 * and null for anything else so the provider refuses to call the model
 * documentless (the SR-1 hallucination guard).
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
  // PDFs are sent directly as a `file` part in the provider; other types → null.
  return null;
}
