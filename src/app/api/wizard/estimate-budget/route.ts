import { NextResponse } from "next/server";
import { z } from "zod";
import { estimateBudget } from "@/lib/ai/operations";
import { handleAiError, requireAuthUser } from "../route-helpers";

export const runtime = "nodejs";

const Body = z.object({
  categorySlugs: z.array(z.string()).min(1),
  selectedDeliverables: z.array(z.string()).min(1),
  businessContext: z.string().min(1),
  companySizeSignal: z
    .enum(["micro", "small", "medium", "large"])
    .nullable()
    .optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if ("error" in auth) return auth.error;

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    const result = await estimateBudget(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return handleAiError(err);
  }
}
