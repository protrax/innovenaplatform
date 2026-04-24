import { NextResponse } from "next/server";
import { z } from "zod";
import { generateOfferText } from "@/lib/ai/offer";
import { handleAiError, requireAuthUser } from "../route-helpers";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  project_id: z.string().uuid(),
  amount: z.number().int().min(100),
  delivery_weeks: z.number().int().min(1).max(260).nullable(),
  key_points: z.string().min(10).max(4000),
});

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if ("error" in auth) return auth.error;

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title, description, budget_min_nok, budget_max_nok")
    .eq("id", parsed.data.project_id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Find tenant name for the authenticated user (first membership)
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenants!inner(name)")
    .eq("user_id", auth.user.id)
    .limit(1)
    .maybeSingle();
  const tenantName =
    (membership?.tenants as unknown as { name: string } | null)?.name ?? "Byrå";

  try {
    const result = await generateOfferText({
      projectTitle: project.title,
      projectDescription: project.description,
      customerBudgetMin: project.budget_min_nok,
      customerBudgetMax: project.budget_max_nok,
      tenantName,
      agencyInput: {
        amount: parsed.data.amount,
        deliveryWeeks: parsed.data.delivery_weeks,
        keyPoints: parsed.data.key_points,
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleAiError(err);
  }
}
