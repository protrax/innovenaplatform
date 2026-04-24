import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listUsers } from "@/lib/admin/users";
import type { UserRole } from "@/lib/supabase/types";

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
  return { userId: user.id };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.error === "unauth" ? 401 : 403 },
    );
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? undefined;
  const role = url.searchParams.get("role") as UserRole | null;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  try {
    const result = await listUsers({
      search,
      role: role ?? undefined,
      limit,
      offset,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
