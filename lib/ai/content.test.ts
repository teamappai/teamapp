import { describe, expect, it } from "vitest";
import { buildDocumentPart } from "./content";

/**
 * Regression lock for the AI content parts:
 *  - Images → a high-detail `image_url` part.
 *  - PDFs → null here (the provider sends them directly as a base64 `file`
 *    part, not via this image-only helper).
 *  - Unsupported types → null, so the provider refuses a documentless call.
 */
describe("buildDocumentPart", () => {
  const buf = Buffer.from("hello");

  it("sends an image as a high-detail image_url content part", () => {
    const part = buildDocumentPart(buf, "image/png");
    expect(part?.type).toBe("image_url");
    // @ts-expect-error narrowed by assertion above
    expect(part.image_url.url).toMatch(/^data:image\/png;base64,/);
    // @ts-expect-error narrowed by assertion above
    expect(part.image_url.detail).toBe("high");
  });

  it("returns null for PDFs (provider sends them directly as a file part)", () => {
    expect(buildDocumentPart(buf, "application/pdf")).toBeNull();
  });

  it("returns null for unsupported types (no documentless model call)", () => {
    expect(buildDocumentPart(buf, "application/octet-stream")).toBeNull();
    expect(buildDocumentPart(buf, "text/plain")).toBeNull();
  });
});
