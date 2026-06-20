import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/profile";
import { canCreateDeals } from "@/lib/deals/access";
import { BUCKETS } from "@/lib/storage";
import { extractContract, ExtractionError } from "@/lib/ai";
import { captureServer } from "@/lib/posthog/server";

// Extraction reads the upload into a Node Buffer and calls the OpenAI SDK
// (PDFs are passed straight through as a base64 file part), so it needs the
// Node.js runtime (not Edge). Vision over a multi-page contract can take a
// while, so allow up to 60s.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/deals/extract  — server-only AI contract extraction (audit SR-1).
 *
 * Body: { dealFileId: string }. Downloads the stored file (RLS-scoped to the
 * caller's company via the anon server client), runs the AI provider, persists
 * the raw response + extracted fields to deal_ai_extractions for provenance,
 * and returns the suggested fields + per-field confidence. The form requires
 * explicit per-field confirmation before any value is applied.
 */
export async function POST(request: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // Same gate as /app/deals/new — agent / team_lead / admin_tc only (F-031).
  if (!canCreateDeals(session.profile.role)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  let dealFileId: string | undefined;
  try {
    const body = (await request.json()) as { dealFileId?: string };
    dealFileId = body.dealFileId;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  if (!dealFileId) {
    return NextResponse.json({ error: "Missing dealFileId." }, { status: 400 });
  }

  const supabase = await createClient();

  // RLS ensures the caller can only read a file on a deal in their company.
  const { data: file, error: fileErr } = await supabase
    .from("deal_files")
    .select("id, storage_path, content_type, original_filename")
    .eq("id", dealFileId)
    .single();
  if (fileErr || !file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  // Download the bytes from the private deal-files bucket.
  const { data: blob, error: dlErr } = await supabase.storage
    .from(BUCKETS.dealFiles)
    .download(file.storage_path);
  if (dlErr || !blob) {
    return NextResponse.json(
      { error: "Could not read the uploaded file." },
      { status: 502 },
    );
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const mimeType = file.content_type ?? blob.type ?? "application/octet-stream";

  // Defensive guard (SR-1): never run extraction on an empty document. A
  // documentless request is exactly what made the model hallucinate plausible
  // fake real-estate data with confidence 1.0.
  if (buffer.byteLength === 0) {
    return NextResponse.json(
      { error: "Cannot extract from empty input.", code: "no_document" },
      { status: 422 },
    );
  }

  try {
    const result = await extractContract(buffer, mimeType);

    // Hallucination guard (SR-1): refuse any result that did not actually have a
    // document attached to the model request — especially the tell-tale signal
    // of every field returning confidence exactly 1.0 with no document. The
    // provider guarantees documentAttached on success, so this only fires if a
    // future code path regresses and calls the model documentless.
    const confidences = Object.values(result.confidence);
    const allMaxConfidence =
      confidences.length > 0 && confidences.every((c) => c === 1);
    if (
      !result.documentAttached ||
      (allMaxConfidence && !result.documentAttached)
    ) {
      console.error(
        "[ai] rejecting suspected hallucination: documentAttached=",
        result.documentAttached,
      );
      return NextResponse.json(
        { error: "Cannot extract from empty input.", code: "no_document" },
        { status: 422 },
      );
    }

    // Persist provenance (audit SR-1). Failure here must not break extraction.
    const { error: insErr } = await supabase
      .from("deal_ai_extractions")
      .insert({
        deal_file_id: file.id,
        model_name: result.modelName,
        raw_response: result.raw as never,
        extracted_fields: {
          fields: result.fields,
          confidence: result.confidence,
        } as never,
      });
    if (insErr) {
      console.error(
        "[ai] failed to persist deal_ai_extractions:",
        insErr.message,
      );
    }

    // PostHog: deal_ai_extraction_completed (SR-1/SR-2 — AI accuracy signal).
    // Corrections happen later in the form (out of scope this phase), so the
    // server reports 0 corrected at extraction time.
    const fieldsExtracted = Object.values(result.fields).filter(
      (v) => v !== null && v !== undefined && v !== "",
    ).length;
    await captureServer(
      "deal_ai_extraction_completed",
      {
        fields_extracted_count: fieldsExtracted,
        fields_corrected_count: 0,
        file_count: 1,
      },
      session.user.id,
      session.profile.company_id
        ? { company: session.profile.company_id }
        : undefined,
    );

    return NextResponse.json({
      fields: result.fields,
      confidence: result.confidence,
      modelName: result.modelName,
    });
  } catch (err) {
    if (err instanceof ExtractionError) {
      const status = err.code === "too_large" ? 413 : 422;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    console.error("[ai] unexpected extraction error:", err);
    return NextResponse.json(
      { error: "AI extraction failed. Please enter details manually." },
      { status: 500 },
    );
  }
}
