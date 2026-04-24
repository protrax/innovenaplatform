import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().email() });

// Sends a magic login link to an existing user via Resend.
// To prevent user enumeration, always returns { ok: true } regardless of
// whether the user exists or the send succeeded.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const admin = createAdminClient();

  try {
    // Supabase doesn't have getUserByEmail yet, so we page through users.
    let userExists = false;
    let page = 1;
    while (page <= 10) {
      const { data: list } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      const users = list?.users ?? [];
      if (users.some((u) => u.email?.toLowerCase() === email)) {
        userExists = true;
        break;
      }
      if (users.length < 1000) break;
      page++;
    }

    if (!userExists) {
      // Deliberately return ok to prevent enumeration.
      return NextResponse.json({ ok: true });
    }

    const { data: linkData, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${appUrl}/api/auth/callback?next=${encodeURIComponent("/")}`,
      },
    });
    if (error) {
      console.error("[magic-link] generateLink failed:", error);
      return NextResponse.json({ ok: true });
    }
    const actionLink = linkData?.properties?.action_link;
    if (!actionLink) return NextResponse.json({ ok: true });

    void sendEmail({
      type: "magic_link",
      to_email: email,
      action_link: actionLink,
    });
  } catch (err) {
    console.error("[magic-link] error:", err);
  }
  return NextResponse.json({ ok: true });
}
