/**
 * Lenker til vilkar og personvernerklaering.
 *
 * Plattformen hadde ingen av delene og heller ingen footer: den solgte
 * abonnementer til 2 990 og 6 990 kr i maneden og samlet inn navn, e-post og
 * telefon, uten at noen av dokumentene fantes noe sted pa domenet.
 *
 * Dokumentene er kanoniske pa innovena.no. Plattformen lenker dit framfor a ha
 * egne kopier — to versjoner som glir fra hverandre er samme problem som
 * prissidene som viste ulike tall for samme tjeneste.
 */

const BASE = "https://www.innovena.no";

export function JuridiskeLenker({
  className = "",
  prefiks,
}: {
  className?: string;
  /** F.eks. «Ved å opprette konto godtar dere». Utelates for en naken lenkerad. */
  prefiks?: string;
}) {
  return (
    <p className={`text-xs text-muted-foreground ${className}`}>
      {prefiks ? `${prefiks} ` : null}
      <a
        href={`${BASE}/vilkar/`}
        target="_blank"
        rel="noopener"
        className="underline underline-offset-2 hover:text-foreground"
      >
        vilkårene
      </a>
      {prefiks ? " og " : " · "}
      <a
        href={`${BASE}/personvern/`}
        target="_blank"
        rel="noopener"
        className="underline underline-offset-2 hover:text-foreground"
      >
        personvernerklæringen
      </a>
      {prefiks ? "." : null}
    </p>
  );
}
