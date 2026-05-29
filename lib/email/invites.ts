import "server-only";
import { Resend } from "resend";
import { ROLE_LABELS, type UserRole } from "@/lib/constants/roles";

const FROM_ADDRESS = "TeamApp <hello@teamapp.ai>";
const REPLY_TO = "phil@teamapp.ai";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type EmailResult = { ok: true } | { ok: false; error: string };

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set — cannot send invitation email.");
    return null;
  }
  return new Resend(apiKey);
}

/** Escape user-supplied strings before interpolating into the HTML body. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function inviteAcceptUrl(token: string): string {
  return `${APP_URL}/accept-invite?token=${encodeURIComponent(token)}`;
}

export type InviteEmailInput = {
  to: string;
  inviterName: string;
  companyName: string;
  role: UserRole;
  token: string;
  welcomeMessage?: string | null;
};

/** Send a single invitation email to an invitee. */
export async function sendInviteEmail(
  input: InviteEmailInput,
): Promise<EmailResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "Email is not configured." };
  }

  const url = inviteAcceptUrl(input.token);
  const roleLabel = ROLE_LABELS[input.role];
  const subject = `${input.inviterName} invited you to join ${input.companyName} on TeamApp`;

  const textLines = [
    `${input.inviterName} has invited you to join ${input.companyName} on TeamApp as a ${roleLabel}.`,
    "",
    ...(input.welcomeMessage?.trim()
      ? [`"${input.welcomeMessage.trim()}"`, ""]
      : []),
    "Accept your invitation:",
    url,
    "",
    "This invitation link expires in 14 days.",
  ];

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <p><strong>${esc(input.inviterName)}</strong> has invited you to join
      <strong>${esc(input.companyName)}</strong> on TeamApp as a
      <strong>${esc(roleLabel)}</strong>.</p>
      ${
        input.welcomeMessage?.trim()
          ? `<blockquote style="margin:16px 0;padding:8px 16px;border-left:3px solid #cbd5e1;color:#475569;">${esc(
              input.welcomeMessage.trim(),
            )}</blockquote>`
          : ""
      }
      <p style="margin:24px 0;">
        <a href="${esc(url)}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Accept invite</a>
      </p>
      <p style="color:#64748b;font-size:13px;">Or paste this link into your browser:<br/>
        <a href="${esc(url)}">${esc(url)}</a>
      </p>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">This invitation link expires in 14 days.</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    replyTo: REPLY_TO,
    subject,
    text: textLines.join("\n"),
    html,
  });

  if (error) {
    console.error("Resend failed to send invite email:", error);
    return {
      ok: false,
      error:
        typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : "Failed to send invitation email.",
    };
  }
  return { ok: true };
}

export type SummaryRecipient = {
  fullName: string;
  email: string;
  role: UserRole;
};

/** Email the inviting team_lead a summary of a (possibly bulk) invite batch. */
export async function sendInviteSummaryEmail(input: {
  to: string;
  inviterName: string;
  companyName: string;
  recipients: SummaryRecipient[];
}): Promise<EmailResult> {
  const resend = getResend();
  if (!resend) return { ok: false, error: "Email is not configured." };

  const n = input.recipients.length;
  const subject = `TeamApp: ${n} invitation${n === 1 ? "" : "s"} sent`;

  const rows = input.recipients
    .map(
      (r) =>
        `  • ${r.fullName || "(no name)"} <${r.email}> — ${ROLE_LABELS[r.role]}`,
    )
    .join("\n");

  const text = [
    `You invited ${n} ${n === 1 ? "person" : "people"} to ${input.companyName}:`,
    "",
    rows,
    "",
    "We've emailed each of them an invitation link.",
  ].join("\n");

  const htmlRows = input.recipients
    .map(
      (r) =>
        `<li>${esc(r.fullName || "(no name)")} &lt;${esc(r.email)}&gt; — ${esc(
          ROLE_LABELS[r.role],
        )}</li>`,
    )
    .join("");

  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <p>You invited <strong>${n}</strong> ${n === 1 ? "person" : "people"} to
      <strong>${esc(input.companyName)}</strong>:</p>
      <ul>${htmlRows}</ul>
      <p style="color:#64748b;">We've emailed each of them an invitation link.</p>
    </div>`;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    replyTo: REPLY_TO,
    subject,
    text,
    html,
  });

  if (error) {
    console.error("Resend failed to send invite summary email:", error);
    return { ok: false, error: "Failed to send summary email." };
  }
  return { ok: true };
}
