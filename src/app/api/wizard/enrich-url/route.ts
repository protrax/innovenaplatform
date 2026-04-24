import { NextResponse } from "next/server";
import { z } from "zod";
import { enrichUrl } from "@/lib/ai/operations";
import { handleAiError, requireAuthUser } from "../route-helpers";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ url: z.string().url() });

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if ("error" in auth) return auth.error;

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  try {
    const result = await enrichUrl({ url: parsed.data.url });
    return NextResponse.json(result);
  } catch (err) {
    return handleAiError(err);
  }
}
