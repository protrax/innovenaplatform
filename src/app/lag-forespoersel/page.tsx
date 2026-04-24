import Link from "next/link";
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
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span
              className="inline-block h-6 w-6 rounded-md bg-brand"
              aria-hidden
            />
            <span>Innovena</span>
          </Link>
          <Link
            href="/logg-inn"
            className="text-sm text-muted-foreground hover:underline"
          >
            Logg inn
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            ✨ Innovena tilbudsassistent
          </span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Få tilbud fra kvalitetssikrede byråer — gratis
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Vi hjelper deg beskrive prosjektet på noen minutter, slik at
            byråene kan gi presise tilbud på akkurat det du trenger. Opptil 5
            matchende byråer får forespørselen umiddelbart.
          </p>
        </div>

        <PublicWizard
          categories={categories ?? []}
          aiEnabled={isAiConfigured()}
        />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Innovena</span>
          <div className="flex gap-4">
            <a href="https://innovena.no">innovena.no</a>
            <Link href="/vilkaar">Vilkår</Link>
            <Link href="/personvern">Personvern</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
