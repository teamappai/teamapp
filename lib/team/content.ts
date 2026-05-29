/**
 * Block-based module content model (stored as JSON in training_modules.content).
 * Mirrors the documented schema in migration 0004. Text-bearing blocks hold an
 * inline-HTML `text` string produced by the Tiptap editor; structured blocks
 * (link/image/file/video) hold their own fields.
 *
 * Shared by the editor, the save-time validators, and (Phase 7) the agent
 * renderer — keep it isomorphic (no server-only imports).
 */

export type CalloutVariant = "info" | "warning" | "tip";

export type ContentBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "link"; url: string; label: string }
  | { type: "video_embed"; provider: "youtube"; url: string }
  | { type: "image"; storage_path: string; alt: string }
  | {
      type: "file_attachment";
      storage_path: string;
      filename: string;
      size_bytes: number;
    }
  | { type: "callout"; variant: CalloutVariant; text: string };

export type ContentBlockType = ContentBlock["type"];

/** All text fields a block contributes (for placeholder scanning). */
function blockText(block: ContentBlock): string[] {
  switch (block.type) {
    case "heading":
    case "paragraph":
    case "callout":
      return [block.text];
    case "link":
      return [block.label, block.url];
    case "image":
      return [block.alt];
    case "file_attachment":
      return [block.filename];
    case "video_embed":
      return [block.url];
  }
}

// ── placeholder detection (F-073, CR-2) ───────────────────────────────────────
const PLACEHOLDER_PHRASES = ["lorem ipsum", "alm content goes here"];
// Standalone TODO / TBD tokens (word boundaries), case-insensitive.
const PLACEHOLDER_TOKENS = /\b(todo|tbd)\b/i;
// Any unreplaced mustache template, e.g. {{ first_name }}.
const MUSTACHE = /\{\{.*?\}\}/;

/** Strip HTML tags so phrase matching works against visible text. */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

/** Scan a single raw string (may contain HTML) for placeholder strings. */
export function scanPlaceholders(raw: string): string[] {
  const found = new Set<string>();
  const text = stripTags(raw);
  const lower = text.toLowerCase();
  for (const phrase of PLACEHOLDER_PHRASES) {
    if (lower.includes(phrase)) found.add(phrase);
  }
  const tokenMatch = text.match(PLACEHOLDER_TOKENS);
  if (tokenMatch) found.add(tokenMatch[1].toUpperCase());
  const mustacheMatch = text.match(MUSTACHE);
  if (mustacheMatch) found.add(mustacheMatch[0]);
  return [...found];
}

/**
 * Returns the list of placeholder strings found across all block text. Empty =
 * clean. Save is blocked when this is non-empty (audit F-073, CR-2).
 */
export function findPlaceholders(blocks: ContentBlock[]): string[] {
  const found = new Set<string>();
  for (const block of blocks) {
    for (const raw of blockText(block)) {
      for (const hit of scanPlaceholders(raw)) found.add(hit);
    }
  }
  return [...found];
}

// ── emoji in titles (F-046) ───────────────────────────────────────────────────
// Pictographic emoji (excludes ordinary punctuation/symbols like ™ via the
// Extended_Pictographic property). Titles must read as plain professional text.
const EMOJI = /\p{Extended_Pictographic}/u;

/** True when the string contains at least one emoji (titles must not). */
export function hasEmoji(text: string): boolean {
  return EMOJI.test(text);
}

// ── spell-check (CR-11) ───────────────────────────────────────────────────────
/**
 * Small custom dictionary of common misspellings → the correction. Checked
 * against module titles and content before publish. Deliberately tiny and
 * high-confidence (no general spell-checker): every entry here is a word we'd
 * be embarrassed to ship. "Acccepting" is called out explicitly in the spec.
 */
const MISSPELLINGS: Record<string, string> = {
  acccepting: "accepting",
  accross: "across",
  agressive: "aggressive",
  apparant: "apparent",
  begining: "beginning",
  beleive: "believe",
  calender: "calendar",
  commited: "committed",
  definately: "definitely",
  occured: "occurred",
  recieve: "receive",
  refered: "referred",
  seperate: "separate",
  succesful: "successful",
  teh: "the",
  untill: "until",
};

/**
 * Returns misspelled words found in a raw string (HTML stripped), each rendered
 * as `"misspelled" → "correction"`. Empty = clean.
 */
export function findMisspellings(raw: string): string[] {
  const text = stripTags(raw);
  const found = new Set<string>();
  for (const word of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    const fix = MISSPELLINGS[word];
    if (fix) found.add(`"${word}" → "${fix}"`);
  }
  return [...found];
}

/** Scan every text-bearing block for misspellings (publish gate, CR-11). */
export function findContentMisspellings(blocks: ContentBlock[]): string[] {
  const found = new Set<string>();
  for (const block of blocks) {
    for (const raw of blockText(block)) {
      for (const hit of findMisspellings(raw)) found.add(hit);
    }
  }
  return [...found];
}

// ── sanitize (F-074) ──────────────────────────────────────────────────────────
/** Strip stray highlight/background formatting leftover from pasted content. */
export function sanitizeHtml(html: string): string {
  return (
    html
      // Drop <mark> wrappers, keep their inner text.
      .replace(/<\/?mark[^>]*>/gi, "")
      // Drop <span> that only carry inline styling, keep inner text.
      .replace(/<span[^>]*style=[^>]*>/gi, "")
      .replace(/<\/span>/gi, "")
      // Remove any leftover background-color inline styles on other tags.
      .replace(/style="[^"]*background-color:[^";]*;?[^"]*"/gi, "")
      .replace(/\s(bgcolor|background)="[^"]*"/gi, "")
      .trim()
  );
}

/** Sanitize every text-bearing block in place (returns a new array). */
export function sanitizeBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => {
    switch (block.type) {
      case "heading":
      case "paragraph":
      case "callout":
        return { ...block, text: sanitizeHtml(block.text) };
      default:
        return block;
    }
  });
}

// ── youtube embeds (F-069 / SR-6) ─────────────────────────────────────────────
/** Extract the 11-char YouTube video id from any common URL form. */
export function youtubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

/** Runtime guard: is this unknown JSON a well-formed block array? */
export function parseBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (b): b is ContentBlock =>
      !!b &&
      typeof b === "object" &&
      typeof (b as { type?: unknown }).type === "string",
  );
}
