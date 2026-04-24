import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeSignupForUser } from "@/lib/finalize-signup";

export const runtime = "nodejs";

const Body = z.object({
  role: z.enum(["byraa", "solo"]),
  fullName: z.string().min(1),
  companyName: z.string().min(1),
});

// Called from the client right after signUp when a session exists
// (i.e. email confirmation is OFF). Stashes signup intent in user_metadata
// AND provisions the tenant immediately. Idempotent.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { role, fullName, companyName } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      {
        error:
          "Ikke autentisert. Sjekk e-posten din for bekreftelseslenke — tenant opprettes automatisk når du klikker lenken.",
      },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      role,
      company_name: companyName,
      full_name: fullName,
    },
  });

  const result = await finalizeSignupForUser(user.id);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: `Kunne ikke fullføre registrering${
          result.error ? `: ${result.error}` : ""
        }`,
      },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, next: result.next });
}
