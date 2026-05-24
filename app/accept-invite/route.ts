import { type NextRequest, NextResponse } from "next/server";
import { getInvitationByToken } from "@/lib/auth/invitations";

/**
 * Entry point for the invitation email link. Validates the token, then forwards
 * to the signup form (where the user sets their name + password) or back to
 * /login with an explanatory message when the invite can't be used. Account
 * creation itself happens in the `acceptInvitation` server action.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  const lookup = await getInvitationByToken(token);
  if (lookup.ok) {
    return NextResponse.redirect(
      `${origin}/signup?token=${encodeURIComponent(token!)}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/login?message=${
      lookup.reason === "missing" ? "invite_required" : "invite_invalid"
    }`,
  );
}
