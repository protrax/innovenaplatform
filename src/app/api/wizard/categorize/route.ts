import { NextResponse } from "next/server";
import { z } from "zod";
import { categorize } from "@/lib/ai/operations";
import { handleAiError, requireAuthUser } from "../route-helpers";

export const runtime = "nodejs";

const Body = z.object({ text: z.string().min(2).max(2000) });

export async function POST(request: Request) {
  const auth = await requireAuthUser();
  if ("error" in auth) return auth.error;

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    const result = await categorize({ userText: parsed.data.text });
    return NextResponse.json(result);
  } catch (err) {
    return handleAiError(err);
  }
}
