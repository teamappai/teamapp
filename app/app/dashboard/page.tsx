import type { Metadata } from "next";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/profile";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Dashboard · TeamApp" };

export default async function DashboardPage() {
  const session = await getSessionProfile();
  const profile = session?.profile;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <UserAvatar
          name={profile?.full_name}
          src={profile?.avatar_url}
          seed={profile?.id}
          size="lg"
        />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}
          </h1>
          {profile ? (
            <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
          ) : null}
        </div>
      </div>
      <p className="text-muted-foreground">
        Your dashboard lands here in a later phase. For now, manage your account
        from your{" "}
        <Link href="/app/profile" className="underline">
          profile
        </Link>
        .
      </p>
    </div>
  );
}
