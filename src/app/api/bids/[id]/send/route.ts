import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: bid } = await supabase
    .from("bids")
    .select("id, status, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!bid) {
    return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  }
  if (bid.status !== "draft") {
    return NextResponse.json(
      { error: "Tilbudet er allerede sendt eller besvart" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("bids")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Notify the customer
  const admin = createAdminClient();
  const { data: fullBid } = await admin
    .from("bids")
    .select(
      "amount_nok, delivery_weeks, tenants!inner(name), projects!inner(title, customer_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (fullBid) {
    const project = fullBid.projects as unknown as {
      title: string;
      customer_id: string;
    };
    const tenant = fullBid.tenants as unknown as { name: string };
    void sendEmail({
      type: "new_bid",
      to_user_id: project.customer_id,
      project_title: project.title,
      tenant_name: tenant.name,
      amount_nok: fullBid.amount_nok,
      delivery_weeks: fullBid.delivery_weeks,
      bid_id: id,
    });
  }

  return NextResponse.json({ ok: true });
}
