import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/api/admin/projects/admin-guard";

export const runtime = "nodejs";

/**
 * Slug havner i URL-er (/tjenester/<slug>) og brukes som stabil nøkkel mot
 * innhold på nettsidene. Store bokstaver, mellomrom og æøå gir enten
 * dobbeltoppføringer eller lenker som brekker, så vi låser formatet her i
 * stedet for å rydde opp i etterkant.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const Body = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(SLUG_PATTERN, "Slug må være små bokstaver og tall, delt med bindestrek"),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  max_agencies_per_lead: z.number().int().min(1).max(10).optional(),
});

/**
 * Oppretter en ny tjenestekategori.
 *
 * Standardverdiene (sort_order 0, max_agencies_per_lead 5, active true) settes
 * av databasen når feltene utelates, så skjemaet trenger bare slug og navn.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const guard = await requireAdmin(supabase);
  if (guard) return guard;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ugyldige verdier" },
      { status: 400 },
    );
  }

  const { slug, name, description, sort_order, max_agencies_per_lead } =
    parsed.data;
  const admin = createAdminClient();

  const { data: clash } = await admin
    .from("service_categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (clash) {
    return NextResponse.json(
      { error: `Slug «${slug}» er allerede i bruk` },
      { status: 409 },
    );
  }

  const { data, error } = await admin
    .from("service_categories")
    .insert({
      slug,
      name,
      description: description || null,
      ...(sort_order !== undefined ? { sort_order } : {}),
      ...(max_agencies_per_lead !== undefined ? { max_agencies_per_lead } : {}),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[admin] Opprettet kategori ${data.id} ("${name}", slug ${slug})`);
  return NextResponse.json({ ok: true, category: data }, { status: 201 });
}
