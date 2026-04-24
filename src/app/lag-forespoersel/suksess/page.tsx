import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Inbox, MailOpen } from "lucide-react";

export const dynamic = "force-dynamic";

type Search = Promise<{ email?: string }>;

export default async function InquirySuccess({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span
              className="inline-block h-6 w-6 rounded-md bg-brand"
              aria-hidden
            />
            <span>Innovena</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        <Card className="border-brand/40">
          <CardHeader className="items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
              <CheckCircle className="h-7 w-7 text-brand" />
            </div>
            <CardTitle className="text-2xl">
              Forespørselen er sendt! 🎉
            </CardTitle>
            <CardDescription>
              Opptil 5 matchende byråer får forespørselen akkurat nå.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <MailOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <div className="text-sm">
                  <div className="font-medium">Sjekk innboksen din</div>
                  <p className="mt-1 text-muted-foreground">
                    {email ? (
                      <>
                        Vi har sendt en innloggingslenke til{" "}
                        <strong className="text-foreground">{email}</strong>.
                        Klikk den for å følge med på tilbudene som kommer inn.
                      </>
                    ) : (
                      "Vi har sendt en innloggingslenke. Klikk den for å følge med på tilbudene."
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium">Hva skjer nå:</div>
              <ol className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-brand">1.</span>
                  <span>
                    Matchende byråer varsles med din forespørsel og begynner å
                    forberede tilbud.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-brand">2.</span>
                  <span>
                    Tilbudene begynner å tikke inn i dashbordet ditt — typisk
                    innen 24–48 timer.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 text-brand">3.</span>
                  <span>
                    Du får varsel på e-post hver gang et nytt tilbud kommer
                    inn. Sammenlikn, still spørsmål, og aksepter når du har
                    funnet riktig partner.
                  </span>
                </li>
              </ol>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="brand">
                <Link href="/logg-inn">
                  <Inbox className="h-4 w-4" /> Gå til innlogging
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href="https://innovena.no">Tilbake til innovena.no</a>
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Fikk du ikke e-posten? Sjekk spam-mappen, eller be om en ny
              lenke på innloggingssiden.
            </p>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-6 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Innovena</span>
        </div>
      </footer>
    </div>
  );
}
