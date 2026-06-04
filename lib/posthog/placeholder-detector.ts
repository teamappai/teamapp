"use client";

import { capture } from "./client";

/**
 * Paranoia bug-catcher (Phase 15, E10 · F-001/F-073/F-066). Fires
 * `placeholder_content_viewed` if user-visible content leaks an unfinished
 * placeholder marker into production. This is NOT a normal product metric — a
 * single occurrence in prod means a content bug shipped.
 *
 * Design constraints (M4): cheap and one-shot. We dedupe per session via an
 * in-memory Set so the same leaked string fires at most once, and we keep the
 * regex narrow so it doesn't false-positive on legitimate copy.
 */
const PLACEHOLDER_RE = /TODO|TBD|\{\{|Lorem ipsum/i;

/** Per-session dedupe — keyed on the matched snippet. */
const seen = new Set<string>();

/**
 * Test `text` for placeholder markers and capture once per session if matched.
 * Pass a stable `location` (route or component name) for triage. Returns true
 * when a (new) placeholder was detected.
 */
export function detectPlaceholder(
  text: string | null | undefined,
  location: string,
): boolean {
  if (!text) return false;
  const match = text.match(PLACEHOLDER_RE);
  if (!match) return false;

  const snippet = text.slice(0, 120);
  const key = `${location}::${snippet}`;
  if (seen.has(key)) return false;
  seen.add(key);

  capture("placeholder_content_viewed", {
    content_text: snippet,
    location,
  });
  return true;
}
