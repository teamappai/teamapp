import { Users } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import type { MemberLite } from "@/lib/messages/types";

/**
 * Thread avatar (fixes F-088): DMs show the other person's single avatar; group
 * threads stack up to three member avatars with an overflow count. Initials
 * fallbacks come from UserAvatar (fixes F-089).
 */
export function ThreadAvatar({
  type,
  others,
  size = "default",
}: {
  type: "direct" | "group" | "channel";
  /** Participants other than the current user. */
  others: MemberLite[];
  size?: "sm" | "default" | "lg";
}) {
  if (type === "direct") {
    const other = others[0];
    return (
      <UserAvatar
        name={other?.name}
        src={other?.avatarUrl}
        seed={other?.id}
        size={size}
      />
    );
  }

  if (others.length === 0) {
    return (
      <span className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-full">
        <Users className="size-4" />
      </span>
    );
  }

  const shown = others.slice(0, 3);
  const overflow = others.length - shown.length;
  return (
    <AvatarGroup>
      {shown.map((m) => (
        <UserAvatar
          key={m.id}
          name={m.name}
          src={m.avatarUrl}
          seed={m.id}
          size={size}
        />
      ))}
      {overflow > 0 ? <AvatarGroupCount>+{overflow}</AvatarGroupCount> : null}
    </AvatarGroup>
  );
}
