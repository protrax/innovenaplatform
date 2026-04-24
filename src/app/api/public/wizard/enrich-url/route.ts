import { NextResponse } from "next/server";
import { z } from "zod";
import { enrichUrl } from "@/lib/ai/operations";
import { corsHeaders, handleAiError } from "../route-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ url: z.string().url() });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid URL" },
      { status: 400, headers: corsHeaders() },
    );
  }
  try {
    const result = await enrichUrl({ url: parsed.data.url });
    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (err) {
    const response = handleAiError(err);
    Object.entries(corsHeaders()).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }
}
