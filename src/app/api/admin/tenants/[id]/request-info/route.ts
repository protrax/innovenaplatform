import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueEmail } from "@/lib/email/send";
import { clientEnv } from "@/lib/env";
import { requireAdmin } from "@/app/api/admin/projects/admin-guard";

export const runtime = "nodejs";

/**
 * Ber et byrå fullføre profilen sin.
 *
 * Finner selv ut hva som mangler, så admin slipper å skrive e-posten manuelt
 * hver gang. Lenken er en engangs innloggingslenke rett til riktig side —
 * uten den ender purringen med «hvor logger jeg inn igjen?».
 *
 * Fagområder redigeres på /byraa/innstillinger, resten på /byraa/profil.
 * Vi sender dem dit det mangler mest, med fagområder som førsteprioritet
 * siden man ikke matches mot noe uten dem.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (guard) return guard;

  const { id } = await params;
  const admin = createAdminClient();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, org_number, website, description, tagline, location, logo_url")
    .eq("id", id)
    .maybeSingle();
  if (!tenant) {
    return NextResponse.json({ error: "Fant ikke byrået" }, { status: 404 });
  }

  const { data: cats } = await admin
    .from("tenant_categories")
    .select("category_id")
    .eq("tenant_id", id);
  const hasCategories = (cats ?? []).length > 0;

  const missing: string[] = [];
  if (!hasCategories)
    missing.push("Fagområdene dere leverer innenfor — uten disse mottar dere ingen forespørsler");
  if (!tenant.org_number) missing.push("Organisasjonsnummer");
  if (!tenant.website) missing.push("Nettadresse");
  if (!tenant.tagline && !tenant.description)
    missing.push("En kort beskrivelse av hva dere er best på");
  if (!tenant.location) missing.push("Hvor dere holder til");
  if (!tenant.logo_url) missing.push("Logo (valgfritt, men profilen ser bedre ut med)");

  if (missing.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: false,
      message: "Profilen er allerede komplett — ingen e-post sendt.",
    });
  }

  // Eieren er den som skal purres. Faller tilbake til første medlem.
  const { data: members } = await admin
    .from("tenant_members")
    .select("role, profiles!inner(email, full_name)")
    .eq("tenant_id", id);
  const owner =
    (members ?? []).find((m) => m.role === "owner") ?? (members ?? [])[0];
  // @ts-expect-error — joinet relasjon
  const email: string | undefined = owner?.profiles?.email;
  if (!email) {
    return NextResponse.json(
      { error: "Fant ingen e-postadresse på byrået." },
      { status: 422 },
    );
  }

  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const nextPath = hasCategories ? "/byraa/profil" : "/byraa/innstillinger";
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${appUrl}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[request-info] generateLink failed:", linkError);
    return NextResponse.json(
      { error: "Kunne ikke lage innloggingslenke." },
      { status: 500 },
    );
  }

  queueEmail({
    type: "profile_incomplete",
    to_email: email,
    tenant_name: tenant.name,
    missing,
    action_link: linkData.properties.action_link,
  });

  return NextResponse.json({
    ok: true,
    sent: true,
    message: `Sendt til ${email} — ba om ${missing.length} ting.`,
  });
}
