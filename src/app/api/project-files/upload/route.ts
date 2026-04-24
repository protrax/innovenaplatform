import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  project_id: z.string().uuid(),
  filename: z.string().min(1).max(500),
  mime_type: z.string().optional(),
  size_bytes: z.number().int().min(0).optional(),
  visibility: z.enum(["shared", "internal"]).default("shared"),
});

// Returns a signed upload URL the client PUTs to, plus the record id we create
// up-front. Client uploads to Storage, then no further API call needed.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Verify participant
  const { data: project } = await supabase
    .from("projects")
    .select("customer_id")
    .eq("id", parsed.data.project_id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const isCustomer = project.customer_id === user.id;
  let tenantId: string | null = null;
  if (!isCustomer) {
    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id);
    const tenantIds = (memberships ?? []).map((m) => m.tenant_id);
    const { data: lead } = tenantIds.length
      ? await supabase
          .from("project_leads")
          .select("tenant_id")
          .eq("project_id", parsed.data.project_id)
          .in("tenant_id", tenantIds)
          .limit(1)
          .maybeSingle()
      : { data: null };
    if (!lead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    tenantId = lead.tenant_id;
  }

  // Generate storage path: projectId/timestamp-random.ext
  const ext = parsed.data.filename.split(".").pop()?.toLowerCase() ?? "bin";
  const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
  const storagePath = `${parsed.data.project_id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;

  const { data: signed, error: signedError } = await supabase.storage
    .from("project-files")
    .createSignedUploadUrl(storagePath);
  if (signedError || !signed) {
    return NextResponse.json(
      { error: signedError?.message ?? "Kunne ikke lage opplastingslenke" },
      { status: 500 },
    );
  }

  // Insert the file record now so RLS can validate the storage upload
  const { data: record, error: insertError } = await supabase
    .from("project_files")
    .insert({
      project_id: parsed.data.project_id,
      tenant_id: tenantId,
      uploaded_by: user.id,
      storage_path: storagePath,
      filename: parsed.data.filename,
      mime_type: parsed.data.mime_type ?? null,
      size_bytes: parsed.data.size_bytes ?? null,
      visibility: parsed.data.visibility,
    })
    .select()
    .single();
  if (insertError || !record) {
    return NextResponse.json(
      { error: insertError?.message ?? "Kunne ikke registrere filen" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    file_id: record.id,
    upload_url: signed.signedUrl,
    token: signed.token,
    path: storagePath,
  });
}
