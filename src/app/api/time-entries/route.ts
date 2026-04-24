import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PostBody = z.object({
  tenant_id: z.string().uuid(),
  project_id: z.string().uuid().nullable().optional(),
  booking_id: z.string().uuid().nullable().optional(),
  consultant_profile_id: z.string().uuid().nullable().optional(),
  label: z.string().max(200).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0.25).max(24),
  description: z.string().min(1).max(1000),
  billable: z.boolean().default(true),
  hourly_rate_nok: z.number().int().min(0).nullable().optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = PostBody.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Verify tenant membership
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", parsed.data.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      tenant_id: parsed.data.tenant_id,
      user_id: user.id,
      project_id: parsed.data.project_id ?? null,
      booking_id: parsed.data.booking_id ?? null,
      consultant_profile_id: parsed.data.consultant_profile_id ?? null,
      label: parsed.data.label ?? null,
      date: parsed.data.date,
      hours: parsed.data.hours,
      description: parsed.data.description,
      billable: parsed.data.billable,
      hourly_rate_nok: parsed.data.hourly_rate_nok ?? null,
      status: "draft",
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Kunne ikke lagre time" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, entry: data });
}
