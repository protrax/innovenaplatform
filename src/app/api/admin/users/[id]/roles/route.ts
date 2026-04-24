import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PostBody = z.object({
  role: z.enum(["customer", "agency_member", "consultant", "admin"]),
});

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

export async function POST(
  request: Request,
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

  const parsed = PostBody.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_roles")
    .upsert({ user_id: id, role: parsed.data.role });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
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

  const url = new URL(request.url);
  const role = url.searchParams.get("role");
  if (!role) {
    return NextResponse.json({ error: "role param required" }, { status: 400 });
  }

  // Prevent an admin from removing their own admin role (safety)
  if (id === auth.actingUserId && role === "admin") {
    return NextResponse.json(
      {
        error:
          "Du kan ikke fjerne din egen admin-rolle. Be en annen admin gjøre det.",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_roles")
    .delete()
    .eq("user_id", id)
    .eq("role", role);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
