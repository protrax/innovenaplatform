import { getResend, getFromEmail, isEmailConfigured } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  tplBidAccepted,
  tplBidRejected,
  tplInvoicePaid,
  tplInvoiceSent,
  tplMagicLink,
  tplNewBid,
  tplNewContactWebhook,
  tplNewLead,
  tplNewMessage,
  tplNewTenantPending,
  tplPaymentReceipt,
  tplProjectReceived,
  tplSubscriptionActivated,
  tplSubscriptionCanceled,
  tplSubscriptionPastDue,
  tplTenantApproved,
  tplTenantRejected,
  tplTenantSuspended,
  type Template,
} from "./templates";

// Discriminated union for all email events. Each one carries enough info to
// render the template AND look up recipients (usually via a user_id or tenant_id).
export type EmailEvent =
  | {
      type: "new_bid";
      to_user_id: string;
      project_title: string;
      tenant_name: string;
      amount_nok: number;
      delivery_weeks: number | null;
      bid_id: string;
    }
  | {
      type: "new_lead";
      to_tenant_id: string;
      project_title: string;
      project_description: string;
      budget_min_nok: number | null;
      budget_max_nok: number | null;
      project_id: string;
    }
  | {
      type: "bid_accepted";
      to_tenant_id: string;
      project_title: string;
      amount_nok: number;
      customer_name: string;
      contract_id: string;
    }
  | {
      type: "bid_rejected";
      to_tenant_id: string;
      project_title: string;
      reason: string | null;
    }
  | {
      type: "new_message";
      to_user_id: string;
      from_name: string;
      body_preview: string;
      thread_label: string;
      thread_url: string;
    }
  | {
      type: "new_message";
      to_tenant_id: string;
      from_name: string;
      body_preview: string;
      thread_label: string;
      thread_url: string;
    }
  | {
      type: "tenant_approved";
      to_tenant_id: string;
      tenant_name: string;
    }
  | {
      type: "invoice_sent";
      to_user_id: string;
      tenant_name: string;
      project_title: string | null;
      total_nok: number;
      payment_url: string;
    }
  | {
      type: "invoice_paid";
      to_tenant_id: string;
      customer_name: string;
      project_title: string | null;
      amount_nok: number;
    }
  | {
      type: "magic_link";
      to_email: string;
      project_title?: string;
      action_link: string;
    }
  | {
      type: "tenant_rejected";
      to_tenant_id: string;
      tenant_name: string;
    }
  | {
      type: "tenant_suspended";
      to_tenant_id: string;
      tenant_name: string;
    }
  | {
      type: "new_tenant_pending";
      to_email: string;
      tenant_name: string;
      tenant_type: string;
      owner_email: string;
    }
  | {
      type: "project_received";
      to_user_id: string;
      project_title: string;
      project_id: string;
    }
  | {
      type: "payment_receipt";
      to_user_id: string;
      tenant_name: string;
      amount_nok: number;
      project_title: string | null;
      paid_at: string;
    }
  | {
      type: "subscription_activated";
      to_tenant_id: string;
      tenant_name: string;
    }
  | {
      type: "subscription_canceled";
      to_tenant_id: string;
      tenant_name: string;
      period_end: string | null;
    }
  | {
      type: "subscription_past_due";
      to_tenant_id: string;
      tenant_name: string;
    }
  | {
      type: "new_contact_webhook";
      to_tenant_id: string;
      contact_name: string;
      source: string;
      contact_id: string;
    };

function templateFor(event: EmailEvent): Template {
  switch (event.type) {
    case "new_bid":
      return tplNewBid(event);
    case "new_lead":
      return tplNewLead(event);
    case "bid_accepted":
      return tplBidAccepted(event);
    case "bid_rejected":
      return tplBidRejected(event);
    case "new_message":
      return tplNewMessage(event);
    case "tenant_approved":
      return tplTenantApproved(event);
    case "invoice_sent":
      return tplInvoiceSent(event);
    case "invoice_paid":
      return tplInvoicePaid(event);
    case "magic_link":
      return tplMagicLink(event);
    case "tenant_rejected":
      return tplTenantRejected(event);
    case "tenant_suspended":
      return tplTenantSuspended(event);
    case "new_tenant_pending":
      return tplNewTenantPending(event);
    case "project_received":
      return tplProjectReceived(event);
    case "payment_receipt":
      return tplPaymentReceipt(event);
    case "subscription_activated":
      return tplSubscriptionActivated(event);
    case "subscription_canceled":
      return tplSubscriptionCanceled(event);
    case "subscription_past_due":
      return tplSubscriptionPastDue(event);
    case "new_contact_webhook":
      return tplNewContactWebhook(event);
  }
}

async function resolveRecipients(event: EmailEvent): Promise<string[]> {
  const admin = createAdminClient();
  if ("to_email" in event) {
    return [event.to_email];
  }
  if ("to_user_id" in event) {
    const { data } = await admin
      .from("profiles")
      .select("email")
      .eq("id", event.to_user_id)
      .maybeSingle();
    return data?.email ? [data.email] : [];
  }
  if ("to_tenant_id" in event) {
    // Send to all owners/admins of the tenant
    const { data: members } = await admin
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", event.to_tenant_id)
      .in("role", ["owner", "admin"]);
    if (!members || members.length === 0) return [];
    const { data: profiles } = await admin
      .from("profiles")
      .select("email")
      .in(
        "id",
        members.map((m) => m.user_id),
      );
    return (profiles ?? []).map((p) => p.email).filter(Boolean);
  }
  return [];
}

/**
 * Send an email for a given event. Fire-and-forget from callers —
 * errors are logged but don't throw, so API routes don't fail due to email issues.
 */
export async function sendEmail(event: EmailEvent): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(`[email] Skipping ${event.type} — Resend not configured`);
    return;
  }

  try {
    const recipients = await resolveRecipients(event);
    if (recipients.length === 0) {
      console.log(`[email] No recipients for ${event.type}`);
      return;
    }
    const template = templateFor(event);
    const resend = getResend();
    const result = await resend.emails.send({
      from: getFromEmail(),
      to: recipients,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    if (result.error) {
      console.error(`[email] Resend error for ${event.type}:`, result.error);
    } else {
      console.log(
        `[email] Sent ${event.type} to ${recipients.length} recipient(s): ${recipients.join(", ")}`,
      );
    }
  } catch (err) {
    console.error(`[email] Failed to send ${event.type}:`, err);
  }
}
