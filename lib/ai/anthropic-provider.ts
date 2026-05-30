import "server-only";
import {
  ExtractionError,
  type AIProvider,
  type ExtractionResult,
} from "./types";

/**
 * STUB — Anthropic Claude fallback provider.
 *
 * TODO(Phase 15): Wire Anthropic Claude as the fallback per the playbook
 * ("AI: OpenAI primary, Anthropic optional fallback (for deal extraction —
 * SR-1)"). Claude's vision + tool-use can mirror the OpenAI structured-output
 * extraction. For now this throws so the provider boundary exists without a
 * half-built implementation.
 */
export class AnthropicProvider implements AIProvider {
  async extract(
    _fileBuffer: Buffer,
    _mimeType: string,
  ): Promise<ExtractionResult> {
    void _fileBuffer;
    void _mimeType;
    throw new ExtractionError(
      "Anthropic extraction provider is not implemented yet (Phase 15).",
      "not_implemented",
    );
  }
}
