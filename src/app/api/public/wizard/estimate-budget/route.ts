import { NextResponse } from "next/server";
import { z } from "zod";
import { estimateBudget } from "@/lib/ai/operations";
import { corsHeaders, handleAiError } from "../route-helpers";

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

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input" },
      { status: 400, headers: corsHeaders() },
    );
  }
  try {
    const result = await estimateBudget(parsed.data);
    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (err) {
    const response = handleAiError(err);
    Object.entries(corsHeaders()).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }
}
