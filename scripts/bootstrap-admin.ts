/**
 * Bootstrap script: promote an existing Supabase user to admin.
 *
 * Usage:
 *   npx tsx scripts/bootstrap-admin.ts jf@snakk.ai
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local.
 * The user must already exist (sign up via /registrer first).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

async function main() {
  loadEnv();
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/bootstrap-admin.ts <email>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up the auth user by email
  const { data: list, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;
  const user = list.users.find((u) => u.email === email);
  if (!user) {
    console.error(`No auth user with email ${email}. Sign up first at /registrer.`);
    process.exit(1);
  }

  const { error: insertError } = await supabase
    .from("user_roles")
    .upsert({ user_id: user.id, role: "admin" });
  if (insertError) throw insertError;

  console.log(`✓ Granted 'admin' role to ${email} (${user.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
