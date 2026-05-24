import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/profile";
import { ROLE_LABELS, type UserRole } from "@/lib/constants/roles";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AvatarUploader } from "./avatar-uploader";
import { ProfileForm } from "./profile-form";
import { ChangePasswordSection } from "./change-password-section";
import { TwoFactorSection } from "./two-factor-section";

export const metadata: Metadata = { title: "Your profile · TeamApp" };

export default async function ProfilePage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const { profile, user, brokerageName, brokerageState } = session;
  const role = profile.role as UserRole;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Your profile</h1>
        <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUploader
            userId={profile.id}
            name={profile.full_name}
            initialUrl={profile.avatar_url}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            role={role}
            brokerageName={brokerageName}
            brokerageState={brokerageState}
            defaults={{
              fullName: profile.full_name ?? "",
              email: user.email ?? profile.email,
              phone: profile.phone ?? "",
              licenseNumber: profile.license_number ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Change the password you use to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordSection />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <TwoFactorSection required={role === "super_admin"} />
        </CardContent>
      </Card>
    </div>
  );
}
