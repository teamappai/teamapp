import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getInvitationByToken } from "@/lib/auth/invitations";
import { ROLE_LABELS } from "@/lib/constants/roles";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account · TeamApp" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const lookup = await getInvitationByToken(token);

  // Signup is invite-only: no valid token means there is nothing to render.
  if (!lookup.ok) {
    redirect(
      lookup.reason === "missing"
        ? "/login?message=invite_required"
        : "/login?message=invite_invalid",
    );
  }

  const { invitation } = lookup;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          You&apos;ve been invited to join as
          <Badge variant="secondary">{ROLE_LABELS[invitation.role]}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm
          token={token!}
          email={invitation.email}
          fullName={invitation.full_name ?? ""}
        />
      </CardContent>
    </Card>
  );
}
