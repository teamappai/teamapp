import posthog from "./client";
import type { UserRole } from "@/lib/constants/roles";

/**
 * Browser-side identity wiring (Phase 15, Decision 6: login + hydration).
 *
 * `identifyUser` ties the anonymous device to a stable user, and
 * `identifyCompany` attaches the user's company as a PostHog *group* so we can
 * run per-customer cohort analysis (the multi-tenant requirement in the audit
 * plan §2). Both are called from the `<Identify>` client component after
 * `posthog.init` has run; `resetIdentity` is called on logout.
 */

export type IdentifyUserInput = {
  id: string;
  email: string | null;
  role: UserRole;
  company_id: string | null;
  created_at: string | null;
};

export type IdentifyCompanyInput = {
  id: string;
  name: string | null;
  plan: string | null;
  seats_used: number | null;
  seats_total: number | null;
  mrr: number | null;
  created_at: string | null;
};

export function identifyUser(user: IdentifyUserInput): void {
  posthog.identify(user.id, {
    email: user.email,
    role: user.role,
    company_id: user.company_id,
    joined_at: user.created_at,
  });
}

export function identifyCompany(company: IdentifyCompanyInput): void {
  posthog.group("company", company.id, {
    name: company.name,
    plan: company.plan,
    seats_used: company.seats_used,
    seats_total: company.seats_total,
    mrr: company.mrr,
    signed_up_at: company.created_at,
  });
}

export function resetIdentity(): void {
  posthog.reset();
}
