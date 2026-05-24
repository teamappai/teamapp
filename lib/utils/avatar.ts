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
 * A readable background color for an avatar fallback, derived from `seed`.
 * Uses a fixed saturation/lightness so white text always has enough contrast.
 */
export function avatarColor(seed?: string | null): string {
  const hue = hashString(seed && seed.length > 0 ? seed : "?") % 360;
  return `hsl(${hue} 62% 45%)`;
}
