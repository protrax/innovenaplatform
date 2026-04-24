import Link from "next/link";
import { SignUpForm } from "./sign-up-form";

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

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#14100e]">
        Opprett kontoen din
      </h1>
      <p className="mt-2 text-sm text-[#64594f]">
        Gratis for alltid. Ingen kortinfo, ingen bindingstid. Oppgrader når du
        vil ha leads levert automatisk.
      </p>
      <div className="mt-8 space-y-6">
        <SignUpForm initialRole={rolle} />
        <p className="text-center text-sm text-[#64594f]">
          Har du konto?{" "}
          <Link
            href="/logg-inn"
            className="font-semibold text-[#c84a1f] underline-offset-4 hover:underline"
          >
            Logg inn
          </Link>
        </p>
      </div>
    </div>
  );
}
