import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizeSignupForUser } from "@/lib/finalize-signup";

// Handles the email confirmation + magic-link redirect from Supabase.
// After exchanging the auth code, finalize signup if the user doesn't have
// a tenant yet (e.g. they just confirmed their e-mail after signing up).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  let next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    if (data.user) {
      const result = await finalizeSignupForUser(data.user.id);
      if (result.ok && !result.alreadyFinalized && next === "/") {
        next = result.next;
      }
    }
  }

  return NextResponse.redirect(new URL(next, url));
}
