import type { Metadata } from "next";
import { sanitizeNext } from "@/lib/auth/redirects";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · TeamApp" };

const MESSAGES: Record<string, string> = {
  invite_required:
    "Accounts are invite-only. Ask your team lead for an invitation.",
  invite_invalid: "That invitation link is invalid or has expired.",
  password_updated: "Your password was updated. Log in to continue.",
  session_expired: "Your session expired. Please log in again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeNext(params.next ?? null);
  const message = params.message ? MESSAGES[params.message] : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Log in to your TeamApp account.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}
