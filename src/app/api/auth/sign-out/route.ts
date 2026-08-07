import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Send folk tilbake til hovedsiden, ikke plattformens byrå-landingsside.
  return NextResponse.redirect("https://innovena.no", { status: 303 });
}
