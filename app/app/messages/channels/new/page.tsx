import { redirect } from "next/navigation";

import { getSessionProfile } from "@/lib/auth/profile";
import type { UserRole } from "@/lib/constants/roles";

const CHANNEL_ADMIN_ROLES: readonly UserRole[] = ["team_lead", "admin_tc"];

/**
 * There is no standalone "create channel" page — creation is a modal. This route
 * exists only to gate direct navigation (criterion 7): non-permitted roles get
 * bounced to the browser, permitted roles land there with the modal open.
 */
export default async function NewChannelPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (!CHANNEL_ADMIN_ROLES.includes(session.profile.role)) {
    redirect("/app/messages/channels");
  }
  redirect("/app/messages/channels?new=1");
}
