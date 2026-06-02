import "server-only";
import { Resend } from "resend";
import { formatPrice } from "@/lib/billing/plans";
import { formatDate } from "@/lib/utils/format";

/**
 * Phase 12 billing emails (Decision 10 matrix). Plain-HTML templates sent via
 * Resend, mirroring lib/email/invites.ts. Subject lines are action-oriented.
 * Super-admin FYI copies always go to phil@teamapp.ai.
 */
const FROM_ADDRESS = "TeamApp <hello@teamapp.ai>";
const REPLY_TO = "phil@teamapp.ai";
const SUPER_ADMIN_EMAIL = "phil@teamapp.ai";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type EmailResult = { ok: true } | { ok: false; error: string };

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send billing email.");
    return null;
  }
  return new Resend(apiKey);
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Section = {
  heading: string;
  lines: string[];
  cta?: { label: string; href: string };
};

function renderHtml({ heading, lines, cta }: Section): string {
  const paras = lines.map((l) => `<p>${esc(l)}</p>`).join("");
  const button = cta
    ? `<p style="margin:24px 0;"><a href="${esc(cta.href)}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">${esc(cta.label)}</a></p>`
    : "";
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="font-size:18px;margin:0 0 12px;">${esc(heading)}</h2>
      ${paras}
      ${button}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">TeamApp · Manage your plan anytime from Billing.</p>
    </div>`;
}

async function send(
  to: string,
  subject: string,
  section: Section,
): Promise<EmailResult> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "Email is not configured." };
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    replyTo: REPLY_TO,
    subject,
    text: [
      section.heading,
      "",
      ...section.lines,
      ...(section.cta ? ["", `${section.cta.label}: ${section.cta.href}`] : []),
    ].join("\n"),
    html: renderHtml(section),
  });
  if (error) {
    console.error("Resend failed to send billing email:", error);
    return { ok: false, error: "Failed to send billing email." };
  }
  return { ok: true };
}

const billingUrl = `${APP_URL}/app/billing`;

// ── Each event in the Decision-10 matrix ──────────────────────────────────────

export function emailSubscriptionCreated(args: {
  to: string;
  companyName: string;
  planName: string;
}) {
  return Promise.all([
    send(args.to, `Welcome to TeamApp ${args.planName}`, {
      heading: `Your ${args.planName} subscription is live`,
      lines: [
        `Thanks for subscribing, ${args.companyName}.`,
        `You can manage your plan, seats, and payment method anytime from Billing.`,
      ],
      cta: { label: "Open Billing", href: billingUrl },
    }),
    send(
      SUPER_ADMIN_EMAIL,
      `[FYI] ${args.companyName} subscribed to ${args.planName}`,
      {
        heading: `New subscription: ${args.companyName}`,
        lines: [`${args.companyName} started a ${args.planName} subscription.`],
      },
    ),
  ]);
}

export function emailTrialEnding(args: {
  to: string;
  daysLeft: number;
  chargeDate: Date | string;
}) {
  return send(args.to, `Your TeamApp trial ends in ${args.daysLeft} days`, {
    heading: "Your card will be charged soon",
    lines: [
      `Your free trial ends in ${args.daysLeft} days.`,
      `On ${formatDate(args.chargeDate, "long")} your card on file will be charged and your subscription begins.`,
      `If you need to change plans or update your card, do it before then.`,
    ],
    cta: { label: "Review your plan", href: billingUrl },
  });
}

export function emailTrialConverted(args: { to: string; planName: string }) {
  return send(args.to, `You're now on TeamApp ${args.planName}`, {
    heading: "Your trial converted to a paid plan",
    lines: [
      `Your ${args.planName} subscription is now active. Thanks for sticking with us.`,
    ],
    cta: { label: "Open Billing", href: billingUrl },
  });
}

export function emailSeats80(args: {
  to: string;
  used: number;
  total: number;
}) {
  return send(args.to, "You're approaching your seat limit", {
    heading: "Add seats before you hit the cap",
    lines: [
      `You're using ${args.used} of ${args.total} seats.`,
      `Add more seats so you can keep inviting your team without interruption.`,
    ],
    cta: { label: "Add seats", href: billingUrl },
  });
}

export function emailSeats90(args: {
  to: string;
  companyName: string;
  used: number;
  total: number;
}) {
  return Promise.all([
    send(args.to, "Action needed: you're almost out of seats", {
      heading: "You're almost out of seats",
      lines: [
        `You're using ${args.used} of ${args.total} seats.`,
        `New invites will be blocked once you reach your limit. Add seats now to avoid interruption.`,
      ],
      cta: { label: "Add seats", href: billingUrl },
    }),
    send(
      SUPER_ADMIN_EMAIL,
      `[FYI] ${args.companyName} at ${args.used}/${args.total} seats`,
      {
        heading: `Seat usage high: ${args.companyName}`,
        lines: [
          `${args.companyName} is using ${args.used} of ${args.total} seats.`,
        ],
      },
    ),
  ]);
}

export function emailPaymentFailed(args: {
  to: string;
  retryByDate?: Date | string | null;
}) {
  const lines = [
    "We couldn't process your latest payment.",
    "We'll automatically retry over the next few days. Update your payment method now to avoid any interruption.",
  ];
  if (args.retryByDate) {
    lines.push(
      `Please update your card by ${formatDate(args.retryByDate, "long")}.`,
    );
  }
  return send(args.to, "Action required: Update your payment method", {
    heading: "Your payment failed",
    lines,
    cta: { label: "Update payment method", href: billingUrl },
  });
}

export function emailPaymentRecovered(args: { to: string }) {
  return send(args.to, "Your payment went through", {
    heading: "You're all set",
    lines: [
      "Your payment was successful and your subscription is active again. Thanks!",
    ],
    cta: { label: "Open Billing", href: billingUrl },
  });
}

export function emailSubscriptionPaused(args: {
  to: string;
  resumeDate?: Date | string | null;
}) {
  const lines = [
    "Your subscription is paused. Your data is safe and you won't be charged while paused.",
  ];
  if (args.resumeDate)
    lines.push(
      `It will resume automatically on ${formatDate(args.resumeDate, "long")}.`,
    );
  return send(args.to, "Your TeamApp subscription is paused", {
    heading: "Subscription paused",
    lines,
    cta: { label: "Resume anytime", href: billingUrl },
  });
}

export function emailCancellationScheduled(args: {
  to: string;
  accessUntil: Date | string;
}) {
  return send(args.to, "Your cancellation is scheduled", {
    heading: "We're sorry to see you go",
    lines: [
      `Your subscription is scheduled to cancel. You'll keep full access until ${formatDate(args.accessUntil, "long")}.`,
      "Changed your mind? You can resume anytime before then.",
    ],
    cta: { label: "Manage subscription", href: billingUrl },
  });
}

export function emailCancellationCompleted(args: { to: string }) {
  return send(args.to, "Your TeamApp subscription has ended", {
    heading: "Your subscription has ended",
    lines: [
      "Your subscription is now cancelled. Thank you for being a TeamApp customer.",
      "Your data is retained — reactivate anytime to pick up where you left off.",
    ],
    cta: { label: "Reactivate", href: billingUrl },
  });
}

export function emailPlanUpgraded(args: { to: string; planName: string }) {
  return send(args.to, `You've upgraded to ${args.planName}`, {
    heading: `Welcome to ${args.planName}`,
    lines: [
      `Your upgrade to ${args.planName} is active. The prorated difference appears on your next invoice.`,
    ],
    cta: { label: "Open Billing", href: billingUrl },
  });
}

export function emailPlanDowngraded(args: {
  to: string;
  planName: string;
  effectiveDate: Date | string;
}) {
  return send(args.to, `Your plan change is scheduled`, {
    heading: "Plan change scheduled",
    lines: [
      `Your downgrade to ${args.planName} will take effect on ${formatDate(args.effectiveDate, "long")}.`,
      "You'll keep your current features until then.",
    ],
    cta: { label: "Open Billing", href: billingUrl },
  });
}

/** Re-export so callers can format dollar amounts consistently in emails. */
export { formatPrice };
