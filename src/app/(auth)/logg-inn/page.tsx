import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-[#14100e]">
        Velkommen tilbake
      </h1>
      <p className="mt-2 text-sm text-[#64594f]">
        Logg inn for å fortsette med pipelinen, leadsene og prosjektene dine.
      </p>
      <div className="mt-8 space-y-6">
        <SignInForm />
        <p className="text-center text-sm text-[#64594f]">
          Har du ikke konto?{" "}
          <Link
            href="/registrer?rolle=byraa"
            className="font-semibold text-[#c84a1f] underline-offset-4 hover:underline"
          >
            Opprett gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
