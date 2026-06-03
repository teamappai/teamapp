"use client";

import { useEffect } from "react";
import { detectPlaceholder } from "@/lib/posthog/placeholder-detector";

/**
 * Paranoia bug-catcher mount island (Phase 15, E10). Scans a blob of
 * about-to-be-rendered authored content for placeholder markers (TODO/TBD/{{ /
 * Lorem ipsum) and fires `placeholder_content_viewed` once per session if found.
 * Renders nothing. Keep `text` to authored/CMS content — never user input.
 */
export function PlaceholderScan({
  text,
  location,
}: {
  text: string | null | undefined;
  location: string;
}) {
  useEffect(() => {
    detectPlaceholder(text, location);
  }, [text, location]);
  return null;
}
