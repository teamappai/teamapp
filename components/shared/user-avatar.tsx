import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils/index";
import { avatarColor, getInitials } from "@/lib/utils/avatar";

type UserAvatarProps = {
  /** Display name — drives the initials and fallback color. */
  name?: string | null;
  /** Public avatar image URL, when the user has uploaded one. */
  src?: string | null;
  /**
   * Stable seed for the fallback color. Defaults to the name; pass a user id
   * when you want the color to stay fixed even if the name changes.
   */
  seed?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
};

/**
 * App-wide avatar (audit F-006). Shows the uploaded image when present,
 * otherwise a deterministic colored circle with the user's initials. Use this
 * everywhere a user is represented rather than the raw shadcn primitive.
 */
export function UserAvatar({
  name,
  src,
  seed,
  size = "default",
  className,
}: UserAvatarProps) {
  const initials = getInitials(name);
  const color = avatarColor(seed ?? name);

  return (
    <Avatar size={size} className={cn(className)}>
      {src ? <AvatarImage src={src} alt={name ?? "User avatar"} /> : null}
      <AvatarFallback
        className="font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
