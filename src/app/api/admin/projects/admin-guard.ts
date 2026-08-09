import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Felles admin-sjekk. Returnerer et feilsvar hvis kallet ikke skal slippe
 * gjennom, ellers null. Samme mønster som /api/admin/tenants/status, samlet
 * ett sted så nye admin-ruter ikke kopierer sjekken feil.
 */
export async function requireAdmin(
  supabase: SupabaseClient,
): Promise<NextResponse | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Ikke innlogget" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!isAdmin) {
    return NextResponse.json({ error: "Krever admin" }, { status: 403 });
  }
  return null;
}
