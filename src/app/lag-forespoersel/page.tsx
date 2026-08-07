import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAiConfigured } from "@/lib/ai/client";
import { PublicWizard } from "./public-wizard";

export const dynamic = "force-dynamic";

export default async function LagForespoerselPage() {
  // Use admin client so we don't need auth for category list
  const admin = createAdminClient();
  const { data: categories } = await admin
    .from("service_categories")
    .select("id, name, slug")
    .eq("active", true)
    .order("sort_order");

  return (
    <div className="flex flex-1 flex-col bg-[#faf9f5] text-[#1a1c1a]">
      {/* ─── Editorial header (matches innovena.no chrome) ─── */}
      <header className="border-b border-[#1a1c1a]/15 bg-[#faf9f5]">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 md:px-12 h-[64px] lg:h-[72px]">
          <Link href="https://innovena.no" className="flex items-center gap-3" aria-label="Innovena – Hjem">
            <div className="lg:w-[160px] lg:h-[36px] w-[130px] h-[30px] relative">
              <Image
                src="/innovena-logo.png"
                fill
                sizes="(max-width: 768px) 130px, 160px"
                alt="Innovena"
                priority
                className="object-contain object-left brightness-0"
              />
            </div>
          </Link>
          <Link
            href="/logg-inn"
            className="text-[12px] font-bold uppercase tracking-[0.15em] text-[#1a1c1a]/65 hover:text-[#1a1c1a] transition-colors"
          >
            Logg inn
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 md:px-8 py-12 md:py-16">
        <div className="mb-10">
          <span className="inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1c1a]/70">
            <span className="inline-block w-2 h-2 bg-[#dfff00] border border-[#1a1c1a]" />
            Innovena tilbudsassistent
          </span>
          <h1 className="mt-4 text-[36px] md:text-[48px] font-extrabold tracking-[-0.025em] leading-[1.02] text-[#1a1c1a] [overflow-wrap:break-word]">
            Få tilbud fra kvalitetssikrede byråer og konsulenter — gratis
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] md:text-[18px] leading-[1.55] text-[#1a1c1a]/70">
            Vi hjelper deg beskrive prosjektet på noen minutter, slik at byråer
            og konsulenter kan gi presise tilbud på akkurat det du trenger.
            Opptil 5 matchende leverandører får forespørselen umiddelbart.
          </p>
        </div>

        <PublicWizard
          categories={categories ?? []}
          aiEnabled={isAiConfigured()}
        />
      </main>

      {/* ─── Editorial footer ─── */}
      <footer className="border-t border-[#1a1c1a]/15 bg-[#faf9f5]">
        <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-6 md:px-12 py-6">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 bg-[#dfff00]" />
            <span className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[#1a1c1a]/55">
              © {new Date().getFullYear()} Innovena AS
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://innovena.no"
              className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[#1a1c1a]/55 hover:text-[#576500] transition-colors"
            >
              innovena.no
            </a>
            <Link
              href="/vilkaar"
              className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[#1a1c1a]/55 hover:text-[#576500] transition-colors"
            >
              Vilkår
            </Link>
            <Link
              href="/personvern"
              className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[#1a1c1a]/55 hover:text-[#576500] transition-colors"
            >
              Personvern
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
