import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInvoicePaymentLink } from "@/lib/stripe/payments";
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

  // Invoice + tenant name + customer email (admin client because we need the
  // customer's email which may not be visible under the tenant member's RLS).
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, tenants!inner(name)")
    .eq("id", id)
    .maybeSingle();
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from("profiles")
    .select("email")
    .eq("id", invoice.customer_id)
    .maybeSingle();
  if (!customer?.email) {
    return NextResponse.json({ error: "Customer email missing" }, { status: 400 });
  }

  try {
    const link = await createInvoicePaymentLink({
      invoiceId: invoice.id,
      amountNok: invoice.amount_nok,
      description: invoice.description ?? "Faktura",
      customerEmail: customer.email,
      tenantName:
        (invoice.tenants as unknown as { name: string } | null)?.name ?? "Byrå",
      platformFeeEnabled: invoice.platform_fee_enabled,
      platformFeePercent: Number(invoice.platform_fee_percent),
    });

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        status: "sent",
        stripe_payment_link_url: link.url,
        stripe_checkout_session_id: link.checkoutSessionId,
      })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Email the customer
    const tenantName =
      (invoice.tenants as unknown as { name: string } | null)?.name ?? "Byrå";
    void sendEmail({
      type: "invoice_sent",
      to_user_id: invoice.customer_id,
      tenant_name: tenantName,
      project_title: null, // could resolve if we store project ref on invoice
      total_nok: link.totalNok,
      payment_url: link.url,
    });

    return NextResponse.json({
      ok: true,
      url: link.url,
      total_nok: link.totalNok,
      platform_fee_nok: link.platformFeeNok,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ukjent feil";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
