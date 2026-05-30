import "server-only";
import { pdfToPng } from "pdf-to-png-converter";

/**
 * Rasterize a contract PDF to PNG page images for gpt-4o vision.
 *
 * Why: most real-world contracts agents upload are FLATTENED e-signed PDFs
 * (Authentisign / DocuSign / Dotloop) with NO extractable text layer. Sending
 * those to the model as a `file` part yields hallucinations because there's
 * nothing to read. Rendering each page to a high-DPI PNG and sending it as a
 * vision `image_url` is gpt-4o's strongest input and bypasses the text-layer
 * requirement entirely.
 */

/** pdf.js renders at 72 DPI per viewport unit; scale to reach the target DPI. */
const TARGET_DPI = 300;
const VIEWPORT_SCALE = TARGET_DPI / 72; // ≈ 4.17

/** Cost guard: only the first N pages are rendered/sent (contracts rarely need more). */
export const MAX_PDF_PAGES = 10;

export type RenderedPdf = {
  pages: Buffer[];
  /** Total pages in the document (may exceed pages.length when truncated). */
  totalPages: number;
  truncated: boolean;
};

/**
 * Render up to {@link MAX_PDF_PAGES} pages of a PDF to PNG buffers at 300 DPI.
 * Throws on a PDF that can't be processed (corrupt / password-protected); the
 * caller maps that to a friendly `pdf_conversion_failed` error.
 */
export async function renderPdfToPngs(pdfBuffer: Buffer): Promise<RenderedPdf> {
  // Cheap metadata-only pass to learn the page count without rendering.
  const meta = await pdfToPng(pdfBuffer, { returnMetadataOnly: true });
  const totalPages = meta.length;
  const pageNumbers = Array.from(
    { length: Math.min(totalPages, MAX_PDF_PAGES) },
    (_, i) => i + 1,
  );

  const rendered = await pdfToPng(pdfBuffer, {
    viewportScale: VIEWPORT_SCALE,
    pagesToProcess: pageNumbers,
    returnPageContent: true,
  });

  const pages = rendered
    .map((p) => p.content)
    .filter((c): c is Buffer => Buffer.isBuffer(c));

  if (pages.length === 0) {
    throw new Error("PDF produced no rendered pages.");
  }

  return {
    pages,
    totalPages,
    truncated: totalPages > MAX_PDF_PAGES,
  };
}
