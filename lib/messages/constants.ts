/**
 * Phase 11 Messages — shared constants. Safe to import from both client and
 * server (no server-only deps).
 */

/** Quick-bar reaction set (Decision 4). Order matters for the toolbar. */
export const REACTION_EMOJIS = [
  "👍",
  "❤️",
  "🎉",
  "✅",
  "👀",
  "😂",
  "🏆",
  "😭",
  "🙏",
  "🔥",
  "💯",
  "🚨",
] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Attachment limits — same policy as Phase 9 requests (Decision 7). */
export const MAX_MESSAGE_FILE_MB = 20;
export const MESSAGE_FILE_ACCEPT =
  "image/png,image/jpeg,application/pdf," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/postscript,image/vnd.adobe.photoshop,.ai,.psd,.fig,.docx";

/** A sender can edit a message for this long after posting (then it locks). */
export const EDIT_WINDOW_MS = 5 * 60 * 1000;

/** Debounce before persisting last_read_at when a thread is opened. */
export const MARK_READ_DEBOUNCE_MS = 1000;

/** Messages longer than this collapse behind a "Show more" toggle. */
export const LONG_MESSAGE_CHARS = 500;

/** Image content types we render as inline thumbnails (vs. a download chip). */
export function isImageType(contentType: string | null | undefined): boolean {
  return !!contentType && /^image\/(png|jpe?g|gif|webp)$/i.test(contentType);
}

function firstName(name: string | null): string {
  return (name ?? "Someone").trim().split(/\s+/)[0] || "Someone";
}

/**
 * Auto-name a group from its members' first names (Decision 10):
 * "Phil, Sarah, Mike" or "Phil, Sarah, Mike and 2 more". Isomorphic so the
 * new-message dialog and the server queries agree.
 */
export function autoGroupName(names: Array<string | null>): string {
  const firsts = names.map(firstName);
  if (firsts.length <= 3) return firsts.join(", ");
  return `${firsts.slice(0, 3).join(", ")} and ${firsts.length - 3} more`;
}
