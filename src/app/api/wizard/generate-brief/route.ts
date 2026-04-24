import { NextResponse } from "next/server";
import { z } from "zod";
import { generateBrief } from "@/lib/ai/operations";
import { handleAiError, requireAuthUser } from "../route-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  categorySlugs: z.array(z.string()).min(1),
  businessContext: z.string().min(1),
  userGoal: z.string().min(1),
  selectedDeliverables: z.array(z.string()).default([]),
  budgetMinNok: z.number().int().nullable(),
  budgetMaxNok: z.number().int().nullable(),
  timeline: z.string().min(1),
  locationPreference: z.string().min(1),
  extraNotes: z.string(),
});

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if ("error" in auth) return auth.error;

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const result = await generateBrief(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return handleAiError(err);
  }
}
