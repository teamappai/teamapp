"use server";

import { getSessionProfile } from "@/lib/auth/profile";
import { formatCurrency } from "@/lib/utils/format";
import {
  fetchCompanyUsers,
  getActivityFeed,
  type DashUser,
  type FeedItem,
} from "@/lib/dashboards/shared";

/**
 * Load the next page of activity-feed events for the signed-in viewer. The
 * SECURITY DEFINER RPC applies the per-role filter (Decision 10), so this
 * always returns only what the caller is allowed to see.
 */
export async function loadMoreActivityFeed(
  offset: number,
): Promise<FeedItem[]> {
  const session = await getSessionProfile();
  if (!session?.profile.company_id) return [];

  const users = await fetchCompanyUsers(session.profile.company_id);
  const userMap = new Map<string, DashUser>(users.map((u) => [u.id, u]));

  return getActivityFeed({
    viewerId: session.user.id,
    users: userMap,
    limit: 50,
    offset,
    fmtCurrency: (cents) => formatCurrency(cents, { compact: true }),
  });
}
