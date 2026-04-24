import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { getResend, getFromEmail, isEmailConfigured } from "@/lib/email/client";

export const runtime = "nodejs";

// Admin-only diagnostic: reports which email env vars are set in the current
// runtime and optionally sends a test email.
//
// GET  → config report (no email sent)
// POST → config report + sends a test email to the admin's own address
export async function GET() {
  return status(false, null);
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return status(true, user.email ?? null);
}

async function status(sendTest: boolean, sendTo: string | null) {
  const report = {
    env: {
      RESEND_API_KEY: Boolean(serverEnv.RESEND_API_KEY),
      RESEND_FROM_EMAIL: serverEnv.RESEND_FROM_EMAIL ?? null,
      ADMIN_EMAIL: serverEnv.ADMIN_EMAIL ?? null,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? null,
    },
    isEmailConfigured: isEmailConfigured(),
    fromEmail: getFromEmail(),
    testEmail: null as
      | null
      | { sent: true; to: string; id?: string }
      | { sent: false; reason: string; error?: string },
  };

  if (sendTest && sendTo) {
    if (!isEmailConfigured()) {
      report.testEmail = {
        sent: false,
        reason: "RESEND_API_KEY missing in this environment",
      };
    } else {
      try {
        const resend = getResend();
        const result = await resend.emails.send({
          from: getFromEmail(),
          to: sendTo,
          subject: "Innovena: e-post diagnose",
          html: `<p>Dette er en test fra <strong>Innovena Platform</strong>.</p>
                 <p>Hvis du ser denne mailen fungerer Resend-integrasjonen i miljøet som sendte den.</p>
                 <p><small>Sendt fra ${getFromEmail()} til ${sendTo}.</small></p>`,
          text: `Innovena e-post diagnose\n\nSendt fra ${getFromEmail()} til ${sendTo}.`,
        });
        if (result.error) {
          report.testEmail = {
            sent: false,
            reason: "Resend API error",
            error: JSON.stringify(result.error),
          };
        } else {
          report.testEmail = {
            sent: true,
            to: sendTo,
            id: result.data?.id,
          };
        }
      } catch (err) {
        report.testEmail = {
          sent: false,
          reason: "Exception thrown",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  return NextResponse.json(report);
}
