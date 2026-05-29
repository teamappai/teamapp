import type { UserRole } from "@/lib/constants/roles";
import type { PublishStatus } from "@/lib/team/sections";

/**
 * Role/publish visibility predicates for the training EXPERIENCE (the learner
 * view). Applied in application code on top of RLS so every viewer — including a
 * team_lead, whose RLS bypass would otherwise surface drafts and other roles'
 * content — sees a consistent "what's published and assigned to my role" view.
 *
 * Visibility model (audit PA-1):
 *   section visible  → published AND (visible_to_roles empty OR includes role)
 *   module visible   → in a visible section AND published AND
 *                       (visible_to_roles empty OR includes role)
 *
 * Empty visible_to_roles = visible to all roles. Kept isomorphic (no
 * server-only imports) so it's unit-testable and shared by the renderer.
 */

type Visible = {
  status: PublishStatus;
  visible_to_roles: UserRole[];
};

export function isVisibleToRole(item: Visible, role: UserRole): boolean {
  if (item.status !== "published") return false;
  return (
    item.visible_to_roles.length === 0 || item.visible_to_roles.includes(role)
  );
}
