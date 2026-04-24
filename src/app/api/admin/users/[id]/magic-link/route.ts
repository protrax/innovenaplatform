import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauth" as const };
  const { data: admin } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!admin) return { error: "forbidden" as const };
  return { actingUserId: user.id };
}

// Generates a magic link for the target user. Returns the URL so the admin
// can share it securely. Supabase also sends the link via email automatically.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauth" ? 401 : 403 },
    );
  }

  const admin = createAdminClient();
  const { data: target } = await admin.auth.admin.getUserById(id);
  if (!target?.user?.email) {
    return NextResponse.json(
      { error: "Bruker har ikke e-post" },
      { status: 404 },
    );
  }

  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: target.user.email,
    options: { redirectTo: `${appUrl}/` },
  });
  if (error || !linkData) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke lage lenke" },
      { status: 500 },
    );
  }

  // Audit: record who did it for accountability
  console.log(
    `[admin] ${auth.actingUserId} generated magic link for ${target.user.email}`,
  );

  // Actually send it via Resend (generateLink alone does NOT send)
  const actionLink = linkData.properties?.action_link;
  if (actionLink) {
    void sendEmail({
      type: "magic_link",
      to_email: target.user.email,
      action_link: actionLink,
    });
  }

  return NextResponse.json({
    ok: true,
    email: target.user.email,
    action_link: actionLink ?? null,
    message:
      "Lenke generert og sendt til brukerens e-post. Del aldri action_link med noen du ikke stoler på.",
  });
}
