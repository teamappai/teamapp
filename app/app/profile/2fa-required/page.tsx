import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/profile";
import { roleHomePath } from "@/lib/constants/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TwoFactorSection } from "../two-factor-section";

export const metadata: Metadata = {
  title: "Set up two-factor authentication · TeamApp",
};

/**
 * Forced 2FA enrollment for super_admins (audit F-008). Middleware redirects
 * any super_admin without a verified factor here. Once enrolled, the component
 * sends them to the admin home.
 */
export default async function TwoFactorRequiredPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  // Anyone who already has 2FA (or isn't required to) shouldn't be stuck here.
  if (session.profile.role !== "super_admin") {
    redirect(roleHomePath(session.profile.role));
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <CardHeader>
          <CardTitle>Secure your account</CardTitle>
          <CardDescription>
            As a platform administrator, you must enable two-factor
            authentication before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSection required redirectOnEnroll="/app/admin" />
        </CardContent>
      </Card>
    </div>
  );
}
