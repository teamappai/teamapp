"use server";

import { revalidatePath } from "next/cache";
import { requireInstaller } from "@/lib/auth/require-installer";
import { logAudit } from "@/lib/audit/log";
import {
  installPlaybook,
  uninstallPlaybook,
  type InstallCapCheck,
} from "@/lib/playbooks/installs";

export type InstallActionResult =
  | { ok: true; sectionsCount: number; modulesCount: number }
  | { ok: false; reason: "cap"; cap: InstallCapCheck }
  | { ok: false; reason: "error"; error: string };

export async function installPlaybookAction(
  playbookId: string,
): Promise<InstallActionResult> {
  const { profile, companyId } = await requireInstaller();
  const res = await installPlaybook({
    playbookId,
    companyId,
    userId: profile.id,
  });

  if (!res.ok && res.reason === "cap") {
    await logAudit({
      actor_user_id: profile.id,
      action: "playbook_install_blocked_by_cap",
      resource_type: "playbook",
      resource_id: playbookId,
      metadata: {
        playbook_id: playbookId,
        current_count: res.cap.current,
        cap: res.cap.cap,
      },
    });
    return res;
  }
  if (!res.ok) return res;

  await logAudit({
    actor_user_id: profile.id,
    action: "playbook_installed",
    resource_type: "playbook",
    resource_id: playbookId,
    metadata: {
      playbook_id: playbookId,
      sections_count: res.sectionsCount,
      modules_count: res.modulesCount,
    },
  });
  revalidatePath("/app/playbooks");
  revalidatePath(`/app/playbooks/${playbookId}`);
  return {
    ok: true,
    sectionsCount: res.sectionsCount,
    modulesCount: res.modulesCount,
  };
}

export async function uninstallPlaybookAction(
  playbookId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { profile, companyId } = await requireInstaller();
  const res = await uninstallPlaybook({ playbookId, companyId });
  if (!res.ok) return res;

  await logAudit({
    actor_user_id: profile.id,
    action: "playbook_uninstalled",
    resource_type: "playbook",
    resource_id: playbookId,
    metadata: { playbook_id: playbookId },
  });
  revalidatePath("/app/playbooks");
  revalidatePath(`/app/playbooks/${playbookId}`);
  return { ok: true };
}
