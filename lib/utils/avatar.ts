/**
 * Deterministic avatar helpers (audit F-006). When a user has no uploaded
 * image we render a colored circle with their initials; the color is derived
 * from a stable seed (their name or id) so it never changes between renders.
 */

/** Up to two uppercase initials from a name; falls back to "?" when empty. */
export function getInitials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Stable 32-bit hash of a string (djb2). */
function hashString(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Curated avatar palette (Phase 14 a11y): every color clears WCAG AA 4.5:1
 * against the white initials. The previous `hsl(h 62% 45%)` formula let bright
 * hues (lime/yellow) through at ~2.4:1. These are Tailwind 700-weight tones.
 */
const AVATAR_COLORS = [
  "#b91c1c", // red-700
  "#c2410c", // orange-700
  "#b45309", // amber-700
  "#047857", // emerald-700
  "#0f766e", // teal-700
  "#155e75", // cyan-800
  "#1d4ed8", // blue-700
  "#4338ca", // indigo-700
  "#6d28d9", // violet-700
  "#7e22ce", // purple-700
  "#be185d", // pink-700
  "#be123c", // rose-700
] as const;

/**
 * A readable background color for an avatar fallback, derived from `seed`.
 * Deterministic per seed and guaranteed to pass contrast with white text.
 */
export function avatarColor(seed?: string | null): string {
  const i =
    hashString(seed && seed.length > 0 ? seed : "?") % AVATAR_COLORS.length;
  return AVATAR_COLORS[i]!;
}
