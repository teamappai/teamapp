/**
 * Deal-specific display helpers.
 */

/**
 * Render a deal's display id as TA-XXXXX. Derived deterministically from the
 * uuid so the same deal always shows the same code without an extra sequence
 * column. (A real monotonic sequence can replace this later without changing
 * call sites.)
 */
export function formatDealId(id: string): string {
  const hex = id.replace(/[^0-9a-f]/gi, "").slice(0, 8) || "0";
  const n = parseInt(hex, 16) % 90000;
  return `TA-${(n + 10000).toString().padStart(5, "0")}`;
}

/** A person's initials for the client chip (e.g. "Dana Reed" -> "DR"). */
export function clientInitials(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const a = firstName?.trim()?.[0] ?? "";
  const b = lastName?.trim()?.[0] ?? "";
  const initials = `${a}${b}`.toUpperCase();
  return initials || "—";
}

/** Full client name, or an em dash when unknown. */
export function clientName(
  firstName?: string | null,
  lastName?: string | null,
): string {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || "—";
}

/**
 * Map a stage display name to the status key used by the `deal` StatusChip
 * domain (lib/constants/status.ts), so a "Closed" stage gets the same green
 * chip everywhere. Unknown stages fall back to a slug and a default chip.
 */
export function stageStatusKey(name: string | null | undefined): string {
  if (!name) return "";
  const n = name.toLowerCase();
  if (n.includes("lost") || n.includes("trash")) return "lost";
  return n.replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
}

export const REPRESENTING_LABELS: Record<"buyer" | "seller" | "dual", string> =
  {
    buyer: "Buyer",
    seller: "Seller",
    dual: "Dual",
  };
