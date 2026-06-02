/**
 * Mention encoding (Decision 3). Mentions are stored in the message body as a
 * compact marker `<@user_id>` so the raw text is portable. At render time we
 * rewrite each marker into a markdown link `[@Name](/app/profile/<id>)`; the
 * markdown renderer's custom anchor turns any `/app/profile/...` link into a
 * colored mention chip. This module is isomorphic (no server-only deps) so the
 * composer, optimistic client renders, and the server query all agree.
 */

const MENTION_RE = /<@([0-9a-fA-F-]{36})>/g;

/**
 * Channel-wide mention marker (Decision 9). `@channel` in a channel notifies
 * every member of that channel. Stored as a literal `<@channel>` marker; only
 * meaningful inside channels (ignored in DMs/groups). Distinct from user `<@id>`
 * markers so the renderer can style it as its own pill.
 */
export const CHANNEL_MENTION_MARKER = "<@channel>";
const CHANNEL_MENTION_HREF = "#channel-mention";

/** All distinct user ids referenced by `<@id>` markers in a message body. */
export function extractMentionIds(body: string | null | undefined): string[] {
  if (!body) return [];
  const ids = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) ids.add(m[1]!);
  return [...ids];
}

/** True when the body contains a `@channel` (`<@channel>`) marker. */
export function hasChannelMention(body: string | null | undefined): boolean {
  return !!body && body.includes(CHANNEL_MENTION_MARKER);
}

/** Escape the characters that would break out of a markdown link label. */
function escapeLabel(name: string): string {
  return name.replace(/[[\]\\]/g, "\\$&");
}

/**
 * Rewrite `<@id>` markers into markdown mention links. `nameOf` resolves an id
 * to a display name; unknown ids fall back to "@someone".
 */
export function mentionsToMarkdown(
  body: string,
  nameOf: (id: string) => string | undefined,
): string {
  return body
    .split(CHANNEL_MENTION_MARKER)
    .join(`[@channel](${CHANNEL_MENTION_HREF})`)
    .replace(MENTION_RE, (_full, id: string) => {
      const name = nameOf(id) ?? "someone";
      return `[@${escapeLabel(name)}](/app/profile/${id})`;
    });
}

/** True when a link href points at a user profile (i.e. render it as a chip). */
export function isMentionHref(href: string | undefined): boolean {
  return !!href && href.startsWith("/app/profile/");
}

/** True when a link href is the `@channel` mention sentinel (distinct pill). */
export function isChannelMentionHref(href: string | undefined): boolean {
  return href === CHANNEL_MENTION_HREF;
}
