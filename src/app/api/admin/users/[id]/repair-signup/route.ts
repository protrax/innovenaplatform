import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizeSignupForUser } from "@/lib/finalize-signup";

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

// For users stuck with no tenant (because of the old "Not authenticated" bug
// or some other failure), run finalize-signup idempotently.
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

  const result = await finalizeSignupForUser(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Kunne ikke reparere signup" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    already_finalized: result.alreadyFinalized ?? false,
    next: result.next,
  });
}
