"use client";

import { toast } from "sonner";

/**
 * Open the Stripe Customer Portal (Decision 3 — C fallback surface). Creates a
 * portal session server-side, then redirects the browser to it. Used for
 * payment-method updates, tax/address edits, and failed-payment recovery.
 */
export async function openPortal(): Promise<void> {
  try {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(body.error ?? "Could not open the billing portal.");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  } catch {
    toast.error("Could not open the billing portal.");
  }
}
