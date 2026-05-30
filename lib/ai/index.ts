import "server-only";
import { OpenAIProvider } from "./openai-provider";
import { AnthropicProvider } from "./anthropic-provider";
import type { AIProvider, ExtractionResult } from "./types";

/**
 * Single entry point for contract extraction. Defaults to OpenAI; the provider
 * is selectable via the AI_EXTRACTION_PROVIDER env var ("openai" | "anthropic")
 * so the Phase 15 Anthropic fallback can be switched on without touching
 * callers (playbook: OpenAI primary, Anthropic optional fallback — SR-1).
 */
function resolveProvider(): AIProvider {
  const choice = (process.env.AI_EXTRACTION_PROVIDER ?? "openai").toLowerCase();
  switch (choice) {
    case "anthropic":
      return new AnthropicProvider();
    case "openai":
    default:
      return new OpenAIProvider();
  }
}

export function extractContract(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  return resolveProvider().extract(fileBuffer, mimeType);
}

export * from "./types";
