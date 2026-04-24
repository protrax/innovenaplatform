import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1">
      {/* Left: form column */}
      <div className="flex flex-1 flex-col bg-[#fbf7f0]">
        <header className="px-8 py-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#64594f] transition-colors hover:text-[#14100e]"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake til forsiden
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">
            <Link
              href="/"
              className="mb-10 inline-flex items-center gap-2 text-base font-semibold tracking-tight text-[#14100e]"
            >
              <span
                className="inline-block h-5 w-5 rounded-md bg-gradient-to-br from-[#ff7849] to-[#c84a1f]"
                aria-hidden
              />
              Innovena
            </Link>
            {children}
          </div>
        </main>
      </div>

      {/* Right: brand/product panel — hidden on mobile */}
      <aside className="relative hidden w-[44%] max-w-2xl flex-col justify-between overflow-hidden bg-[#14100e] text-[#f6f1ea] lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 top-20 h-[420px] w-[420px] rounded-full bg-[#ff7849]/20 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative p-12">
          <div className="mb-16 inline-flex items-center gap-2 rounded-full border border-[#ff7849]/30 bg-[#ff7849]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ff9975]">
            For byrå og konsulenter
          </div>
          <h2 className="max-w-md text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
            Leads rett i pipelinen.{" "}
            <span className="block text-[#ff9975]">CRM gratis.</span>
          </h2>
          <ul className="mt-10 space-y-3 text-white/80">
            {[
              "Pipeline, AI-tilbud og prosjektstyring — gratis",
              "Kvalifiserte leads fra 990 kr/mnd (Solo)",
              "Ingen bindingstid, ingen kortinfo for å starte",
            ].map((b) => (
              <li key={b} className="flex items-start gap-3 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff9975]" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Product screenshot peeking at bottom */}
        <div className="relative px-12 pb-0">
          <div className="overflow-hidden rounded-t-xl bg-[#100c0a] ring-1 ring-white/10 shadow-[0_-20px_60px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-white/10" />
              <span className="h-2 w-2 rounded-full bg-white/10" />
              <span className="h-2 w-2 rounded-full bg-white/10" />
            </div>
            <Image
              src="/product-shots/pipeline.png"
              alt=""
              width={1800}
              height={1200}
              className="h-auto w-full"
              priority={false}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
