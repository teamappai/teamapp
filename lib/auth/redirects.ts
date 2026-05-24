/**
 * Returns `next` only when it is a safe in-app path (starts with a single "/"),
 * otherwise null. Prevents open-redirects via a crafted `?next=` parameter.
 */
export function sanitizeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}
