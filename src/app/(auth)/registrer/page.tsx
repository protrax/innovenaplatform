import Link from "next/link";
import { SignUpForm } from "./sign-up-form";
import { createAdminClient } from "@/lib/supabase/admin";

type RoleChoice = "byraa" | "solo";

type Search = Promise<{ rolle?: string }>;

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const params = await searchParams;
  const raw = params.rolle;
  const rolle: RoleChoice = raw === "solo" ? "solo" : "byraa";

  // Hentes med admin-klienten fordi brukeren ikke er innlogget ennå.
  const admin = createAdminClient();
  const { data: categories } = await admin
    .from("service_categories")
    .select("id, name")
    .eq("active", true)
    .order("sort_order");

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1a]">
        Opprett kontoen din
      </h1>
      <p className="mt-2 text-sm text-[#6b6d68]">
        Gratis for alltid. Ingen kortinfo, ingen bindingstid. Oppgrader når du
        vil ha leads levert automatisk.
      </p>
      <div className="mt-8 space-y-6">
        <SignUpForm initialRole={rolle} categories={categories ?? []} />
        <p className="text-center text-sm text-[#6b6d68]">
          Har du konto?{" "}
          <Link
            href="/logg-inn"
            className="font-semibold text-[#576500] underline-offset-4 hover:underline"
          >
            Logg inn
          </Link>
        </p>
        <p className="rounded-md border border-[#1a1c1a]/10 bg-[#f4f4f0] p-3 text-center text-sm text-[#6b6d68]">
          Skal du <strong className="text-[#1a1c1a]">ha et prosjekt gjort</strong>?
          Du trenger ikke opprette konto —{" "}
          <Link
            href="/lag-forespoersel"
            className="font-semibold text-[#576500] underline-offset-4 hover:underline"
          >
            beskriv prosjektet her
          </Link>{" "}
          så får du tilbud fra kvalitetssikrede byråer.
        </p>
      </div>
    </div>
  );
}
