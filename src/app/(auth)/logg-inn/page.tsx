import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#1a1c1a]">
        Velkommen tilbake
      </h1>
      <p className="mt-2 text-sm text-[#6b6d68]">
        Logg inn for å fortsette med pipelinen, leadsene og prosjektene dine.
      </p>
      <div className="mt-8 space-y-6">
        <SignInForm />
        <p className="text-center text-sm text-[#6b6d68]">
          Er du byrå eller konsulent uten konto?{" "}
          <Link
            href="/registrer?rolle=byraa"
            className="font-semibold text-[#576500] underline-offset-4 hover:underline"
          >
            Opprett gratis
          </Link>
        </p>
        <p className="rounded-md border border-[#1a1c1a]/10 bg-[#f4f4f0] p-3 text-center text-sm text-[#6b6d68]">
          Skal du <strong className="text-[#1a1c1a]">ha et prosjekt gjort</strong>?{" "}
          <Link
            href="/lag-forespoersel"
            className="font-semibold text-[#576500] underline-offset-4 hover:underline"
          >
            Beskriv prosjektet her
          </Link>{" "}
          — du får automatisk konto og innloggingslenke på e-post.
        </p>
      </div>
    </div>
  );
}
