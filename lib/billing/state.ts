import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { isStripeConfigured } from "@/lib/billing/env";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/types/supabase";

export type Company = Database["public"]["Tables"]["companies"]["Row"];

/** Load a company row by id via the service client (server-only). */
export async function getCompany(companyId: string): Promise<Company | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}

export type PaymentMethodSummary = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type InvoiceSummary = {
  id: string;
  amountCents: number;
  created: number; // unix seconds
  status: string; // paid | open | uncollectible | void | draft
  hostedUrl: string | null;
  pdfUrl: string | null;
  number: string | null;
};

/** Default card on file, or null when none / Stripe not configured. */
export async function getPaymentMethod(
  customerId: string | null,
): Promise<PaymentMethodSummary | null> {
  if (!customerId || !isStripeConfigured()) return null;
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });
  if (customer.deleted) return null;

  let pm = customer.invoice_settings
    ?.default_payment_method as Stripe.PaymentMethod | null;

  // Fall back to the first card on file if no default is set.
  if (!pm) {
    const list = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });
    pm = list.data[0] ?? null;
  }
  if (!pm?.card) return null;

  return {
    brand: pm.card.brand,
    last4: pm.card.last4,
    expMonth: pm.card.exp_month,
    expYear: pm.card.exp_year,
  };
}

function toInvoiceSummary(inv: Stripe.Invoice): InvoiceSummary {
  return {
    id: inv.id ?? "",
    amountCents: inv.amount_paid || inv.amount_due || inv.total || 0,
    created: inv.created,
    status: inv.status ?? "draft",
    hostedUrl: inv.hosted_invoice_url ?? null,
    pdfUrl: inv.invoice_pdf ?? null,
    number: inv.number ?? null,
  };
}

/** The most recent invoice, or null. */
export async function getLatestInvoice(
  customerId: string | null,
): Promise<InvoiceSummary | null> {
  if (!customerId || !isStripeConfigured()) return null;
  const stripe = getStripe();
  const list = await stripe.invoices.list({ customer: customerId, limit: 1 });
  const inv = list.data[0];
  return inv ? toInvoiceSummary(inv) : null;
}

/** A page of invoices for the billing-history tab. */
export async function listInvoices(
  customerId: string | null,
  opts?: { limit?: number; startingAfter?: string },
): Promise<{ invoices: InvoiceSummary[]; hasMore: boolean }> {
  if (!customerId || !isStripeConfigured()) {
    return { invoices: [], hasMore: false };
  }
  const stripe = getStripe();
  const list = await stripe.invoices.list({
    customer: customerId,
    limit: opts?.limit ?? 25,
    starting_after: opts?.startingAfter,
  });
  return {
    invoices: list.data.map(toInvoiceSummary),
    hasMore: list.has_more,
  };
}

/** Format "Visa ending in 4242 — expires 12/27" (audit F-095). */
export function formatPaymentMethod(pm: PaymentMethodSummary | null): string {
  if (!pm) return "No payment method on file";
  const brand = pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1);
  const yy = String(pm.expYear).slice(-2);
  const mm = String(pm.expMonth).padStart(2, "0");
  return `${brand} ending in ${pm.last4} — expires ${mm}/${yy}`;
}
