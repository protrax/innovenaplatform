import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";

const Body = z.object({
  tenant_id: z.string().uuid(),
  status: z.enum(["pending_approval", "active", "suspended", "rejected"]),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { tenant_id, status } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: prevTenant } = await supabase
    .from("tenants")
    .select("name, status")
    .eq("id", tenant_id)
    .maybeSingle();

  const { error } = await supabase
    .from("tenants")
    .update({ status })
    .eq("id", tenant_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email the tenant owners on status transitions that matter.
  if (prevTenant?.name && prevTenant.status !== status) {
    if (status === "active") {
      void sendEmail({
        type: "tenant_approved",
        to_tenant_id: tenant_id,
        tenant_name: prevTenant.name,
      });
    } else if (status === "rejected") {
      void sendEmail({
        type: "tenant_rejected",
        to_tenant_id: tenant_id,
        tenant_name: prevTenant.name,
      });
    } else if (status === "suspended") {
      void sendEmail({
        type: "tenant_suspended",
        to_tenant_id: tenant_id,
        tenant_name: prevTenant.name,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
