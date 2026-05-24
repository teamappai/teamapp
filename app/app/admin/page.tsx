import type { Metadata } from "next";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/profile";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Admin · TeamApp" };

export default async function AdminPage() {
  const session = await getSessionProfile();
  const profile = session?.profile;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Platform admin
        </h1>
        {profile ? (
          <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
        ) : null}
      </div>
      <p className="text-muted-foreground">
        The super-admin console lands here in a later phase. Manage your account
        from your{" "}
        <Link href="/app/profile" className="underline">
          profile
        </Link>
        .
      </p>
    </div>
  );
}
