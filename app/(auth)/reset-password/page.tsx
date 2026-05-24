import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set a new password · TeamApp" };

export default async function ResetPasswordPage() {
  // The /auth/confirm handler exchanges the recovery link for a session before
  // redirecting here. If there's no session, the link was invalid or expired.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          Choose a new password for your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {user ? (
          <ResetPasswordForm />
        ) : (
          <Alert variant="destructive">
            <AlertDescription>
              This reset link is invalid or has expired. Request a new one from
              the forgot-password page.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="text-muted-foreground justify-center text-sm">
        <Link href="/forgot-password" className="hover:text-foreground">
          Request a new link
        </Link>
      </CardFooter>
    </Card>
  );
}
