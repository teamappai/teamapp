"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTeamLead } from "@/lib/auth/require-team-lead";
import { logAudit } from "@/lib/audit/log";
import {
  createInvitation,
  findConflictingEmails,
  refreshInvitation,
} from "@/lib/team/invitations";
import {
  sendInviteEmail,
  sendInviteSummaryEmail,
  type SummaryRecipient,
} from "@/lib/email/invites";
import {
  singleInviteSchema,
  bulkInviteSchema,
  editUserSchema,
  type SingleInviteInput,
  type BulkInviteInput,
  type EditUserInput,
} from "@/lib/validations/team";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type ActionResult =
  | { ok: true }
  | { ok: true; count: number }
  | { ok: false; error: string };

type InviteContext = {
  companyId: string;
  companyName: string;
  inviterName: string;
  inviterUserId: string;
  inviterEmail: string;
};

async function teamLeadContext(): Promise<InviteContext | { error: string }> {
  const { profile, companyId, companyName } = await requireTeamLead();
  if (!companyId) {
    return { error: "Super admins manage users from the admin console." };
  }
  return {
    companyId,
    companyName: companyName ?? "your team",
    inviterName: profile.full_name ?? "A teammate",
    inviterUserId: profile.id,
    inviterEmail: profile.email,
  };
}

/** Fire the invitee email; log + report failures (domain unverified, rate limit). */
async function deliverInvite(
  ctx: InviteContext,
  args: {
    email: string;
    fullName: string | null;
    role: SummaryRecipient["role"];
    token: string;
    welcomeMessage?: string | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await sendInviteEmail({
    to: args.email,
    inviterName: ctx.inviterName,
    companyName: ctx.companyName,
    role: args.role,
    token: args.token,
    welcomeMessage: args.welcomeMessage,
  });
  if (!res.ok) {
    await logAudit({
      actor_user_id: ctx.inviterUserId,
      action: "invitation_send_failed",
      resource_type: "user",
      metadata: { email: args.email, error: res.error },
    });
  }
  return res;
}

export async function inviteSingle(
  input: SingleInviteInput,
): Promise<ActionResult> {
  const ctx = await teamLeadContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = singleInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form and try again." };
  }
  const { fullName, email, role, welcomeMessage, assignedModuleIds } =
    parsed.data;

  const conflicts = await findConflictingEmails(ctx.companyId, [email]);
  if (conflicts.has(email)) {
    return {
      ok: false,
      error: "That email already has an account or a pending invite.",
    };
  }

  const created = await createInvitation({
    companyId: ctx.companyId,
    email,
    fullName,
    role,
    invitedBy: ctx.inviterUserId,
    welcomeMessage,
    assignedModuleIds,
  });
  if (!created.ok) return { ok: false, error: created.error };

  const sent = await deliverInvite(ctx, {
    email,
    fullName,
    role,
    token: created.invitation.token,
    welcomeMessage,
  });
  if (!sent.ok) {
    return {
      ok: false,
      error: `Invitation saved, but the email couldn't be sent: ${sent.error}`,
    };
  }

  await sendInviteSummaryEmail({
    to: ctx.inviterEmail,
    inviterName: ctx.inviterName,
    companyName: ctx.companyName,
    recipients: [{ fullName, email, role }],
  });

  revalidatePath("/app/users");
  return { ok: true, count: 1 };
}

export async function inviteBulk(
  input: BulkInviteInput,
): Promise<ActionResult> {
  const ctx = await teamLeadContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = bulkInviteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the invitee list.",
    };
  }
  const { rows, welcomeMessage } = parsed.data;

  // Reject duplicate emails within the batch.
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.email)) {
      return { ok: false, error: `Duplicate email in list: ${r.email}` };
    }
    seen.add(r.email);
  }

  const conflicts = await findConflictingEmails(
    ctx.companyId,
    rows.map((r) => r.email),
  );
  const blocked = rows.filter((r) => conflicts.has(r.email));
  if (blocked.length) {
    return {
      ok: false,
      error: `${blocked.length} email(s) already have an account or pending invite: ${blocked
        .map((r) => r.email)
        .join(", ")}`,
    };
  }

  const sentRecipients: SummaryRecipient[] = [];
  const failures: string[] = [];
  for (const r of rows) {
    const created = await createInvitation({
      companyId: ctx.companyId,
      email: r.email,
      fullName: r.fullName || null,
      role: r.role,
      invitedBy: ctx.inviterUserId,
      welcomeMessage,
    });
    if (!created.ok) {
      failures.push(`${r.email} (${created.error})`);
      continue;
    }
    const sent = await deliverInvite(ctx, {
      email: r.email,
      fullName: r.fullName || null,
      role: r.role,
      token: created.invitation.token,
      welcomeMessage,
    });
    if (sent.ok) {
      sentRecipients.push({
        fullName: r.fullName || "",
        email: r.email,
        role: r.role,
      });
    } else {
      failures.push(`${r.email} (${sent.error})`);
    }
  }

  if (sentRecipients.length) {
    await sendInviteSummaryEmail({
      to: ctx.inviterEmail,
      inviterName: ctx.inviterName,
      companyName: ctx.companyName,
      recipients: sentRecipients,
    });
  }

  revalidatePath("/app/users");

  if (failures.length) {
    return {
      ok: false,
      error: `Sent ${sentRecipients.length}. Failed for: ${failures.join("; ")}`,
    };
  }
  return { ok: true, count: sentRecipients.length };
}

export async function resendInvite(
  invitationId: string,
): Promise<ActionResult> {
  const ctx = await teamLeadContext();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const refreshed = await refreshInvitation(invitationId);
  if (!refreshed.ok) return { ok: false, error: refreshed.error };
  const inv = refreshed.invitation;

  const sent = await deliverInvite(ctx, {
    email: inv.email,
    fullName: inv.full_name,
    role: inv.role,
    token: inv.token,
    welcomeMessage: inv.welcome_message,
  });
  if (!sent.ok) return { ok: false, error: sent.error };

  await logAudit({
    actor_user_id: ctx.inviterUserId,
    action: "invite_resent",
    resource_type: "user",
    metadata: { email: inv.email },
  });

  return { ok: true };
}

export async function editUser(input: EditUserInput): Promise<ActionResult> {
  await requireTeamLead();
  const parsed = editUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the form." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({
      full_name: parsed.data.fullName.trim(),
      role: parsed.data.role,
    })
    .eq("id", parsed.data.userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/users");
  return { ok: true };
}

export async function resetUserPassword(email: string): Promise<ActionResult> {
  await requireTeamLead();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/auth/confirm?next=/reset-password`,
  });
  if (error) return { ok: false, error: "Could not send reset email." };
  return { ok: true };
}

export async function setUserArchived(
  userId: string,
  archived: boolean,
): Promise<ActionResult> {
  await requireTeamLead();
  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({ status: archived ? "archived" : "active" })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/users");
  return { ok: true };
}
