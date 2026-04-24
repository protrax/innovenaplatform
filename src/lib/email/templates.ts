import { clientEnv } from "@/lib/env";

function baseUrl(): string {
  return clientEnv.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function shell(content: string, preheader?: string): string {
  return `<!doctype html>
<html lang="nb">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Innovena</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0a0a0a;">
    ${preheader ? `<div style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #e5e5e5;">
                <a href="${baseUrl()}" style="text-decoration:none;color:#0a0a0a;font-weight:600;font-size:16px;">
                  <span style="display:inline-block;width:16px;height:16px;background:#3b5bf8;border-radius:4px;vertical-align:middle;margin-right:8px;"></span>Innovena Platform
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">${content}</td>
            </tr>
            <tr>
              <td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e5e5e5;color:#737373;font-size:12px;">
                Denne e-posten ble sendt fra Innovena Platform. <a href="${baseUrl()}" style="color:#737373;">Gå til dashboard</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="background:#3b5bf8;border-radius:6px;"><a href="${href}" style="display:inline-block;padding:10px 20px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${label}</a></td></tr></table>`;
}

function nok(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(amount);
}

export interface Template {
  subject: string;
  html: string;
  text: string;
}

// =============================================================================
// Customer: new bid received
// =============================================================================
export function tplNewBid(input: {
  project_title: string;
  tenant_name: string;
  amount_nok: number;
  delivery_weeks: number | null;
  bid_id: string;
}): Template {
  const url = `${baseUrl()}/kunde/tilbud/${input.bid_id}`;
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Nytt tilbud på prosjektet ditt 🎉</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      <strong>${input.tenant_name}</strong> har sendt et tilbud på <em>${input.project_title}</em>.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0;width:100%;background:#fafafa;border-radius:6px;padding:12px;">
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#525252;">Pris</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:600;">${nok(input.amount_nok)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:14px;color:#525252;border-top:1px solid #e5e5e5;">Leveringstid</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;border-top:1px solid #e5e5e5;">${input.delivery_weeks ? `${input.delivery_weeks} uker` : "—"}</td>
      </tr>
    </table>
    ${button("Se tilbudet", url)}
    <p style="margin:16px 0 0;color:#737373;font-size:13px;">Du kan sammenlikne alle tilbudene dine inne på prosjektsiden før du aksepterer ett.</p>
  `;
  return {
    subject: `Nytt tilbud fra ${input.tenant_name} på ${input.project_title}`,
    html: shell(content, `${input.tenant_name} har sendt ${nok(input.amount_nok)} for ${input.project_title}`),
    text: `${input.tenant_name} har sendt et tilbud på ${input.project_title}: ${nok(input.amount_nok)}${input.delivery_weeks ? `, ${input.delivery_weeks} uker` : ""}.\n\nSe tilbudet: ${url}`,
  };
}

// =============================================================================
// Agency: new lead distributed
// =============================================================================
export function tplNewLead(input: {
  project_title: string;
  project_description: string;
  budget_min_nok: number | null;
  budget_max_nok: number | null;
  project_id: string;
}): Template {
  const url = `${baseUrl()}/byraa/leads/${input.project_id}`;
  const budget =
    input.budget_min_nok || input.budget_max_nok
      ? `${nok(input.budget_min_nok)} – ${nok(input.budget_max_nok)}`
      : "Ikke oppgitt";
  const excerpt = input.project_description.slice(0, 200) +
    (input.project_description.length > 200 ? "…" : "");
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Ny lead: ${input.project_title}</h1>
    <p style="margin:0 0 12px;color:#404040;font-size:15px;line-height:1.5;">En kunde har publisert en ny forespørsel som matcher dine kategorier.</p>
    <div style="background:#fafafa;border-radius:6px;padding:16px;margin:12px 0;font-size:14px;line-height:1.5;color:#404040;">${excerpt}</div>
    <p style="margin:8px 0;color:#525252;font-size:14px;"><strong>Budsjett:</strong> ${budget}</p>
    ${button("Se lead og send tilbud", url)}
    <p style="margin:16px 0 0;color:#737373;font-size:13px;">Vær først ute — kunder velger ofte de som svarer raskt og presist.</p>
  `;
  return {
    subject: `Ny lead: ${input.project_title}`,
    html: shell(content, `Budsjett: ${budget}`),
    text: `Ny lead: ${input.project_title}\n\n${excerpt}\n\nBudsjett: ${budget}\n\nSe lead: ${url}`,
  };
}

// =============================================================================
// Agency: bid accepted
// =============================================================================
export function tplBidAccepted(input: {
  project_title: string;
  amount_nok: number;
  customer_name: string;
  contract_id: string;
}): Template {
  const url = `${baseUrl()}/kontrakter/${input.contract_id}`;
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">🎉 Tilbudet ditt ble akseptert!</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      <strong>${input.customer_name}</strong> aksepterte tilbudet på <em>${input.project_title}</em> (${nok(input.amount_nok)}).
    </p>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">Kontrakten er signert elektronisk av begge parter. Nå er det bare å komme i gang.</p>
    ${button("Åpne kontrakten", url)}
  `;
  return {
    subject: `🎉 Tilbudet ditt ble akseptert: ${input.project_title}`,
    html: shell(content),
    text: `${input.customer_name} aksepterte tilbudet ditt på ${input.project_title}. Kontrakt: ${url}`,
  };
}

// =============================================================================
// Agency: bid rejected
// =============================================================================
export function tplBidRejected(input: {
  project_title: string;
  reason: string | null;
}): Template {
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Tilbudet ble dessverre avslått</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Kunden valgte å ikke gå videre med tilbudet på <em>${input.project_title}</em>.
    </p>
    ${input.reason ? `<div style="background:#fafafa;border-radius:6px;padding:12px;font-size:14px;color:#525252;"><strong>Begrunnelse:</strong> ${input.reason}</div>` : ""}
    <p style="margin:16px 0 0;color:#737373;font-size:13px;">Ta det som et signal, ikke en dom. Innsikt om hva kunder velger gjør deg skarpere neste gang.</p>
  `;
  return {
    subject: `Avslag: ${input.project_title}`,
    html: shell(content),
    text: `Tilbudet ditt på ${input.project_title} ble avslått.${input.reason ? `\n\nBegrunnelse: ${input.reason}` : ""}`,
  };
}

// =============================================================================
// New message
// =============================================================================
export function tplNewMessage(input: {
  from_name: string;
  body_preview: string;
  thread_label: string;
  thread_url: string;
}): Template {
  const preview = input.body_preview.slice(0, 200) +
    (input.body_preview.length > 200 ? "…" : "");
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Ny melding fra ${input.from_name}</h1>
    <p style="margin:0 0 8px;color:#737373;font-size:13px;">${input.thread_label}</p>
    <div style="background:#fafafa;border-radius:6px;padding:16px;margin:12px 0;font-size:14px;line-height:1.5;color:#404040;white-space:pre-wrap;">${preview}</div>
    ${button("Svar", input.thread_url)}
  `;
  return {
    subject: `Ny melding fra ${input.from_name}`,
    html: shell(content, preview),
    text: `${input.from_name} sendte:\n\n${preview}\n\nSvar: ${input.thread_url}`,
  };
}

// =============================================================================
// Tenant approved
// =============================================================================
export function tplTenantApproved(input: { tenant_name: string }): Template {
  const url = `${baseUrl()}/byraa`;
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">${input.tenant_name} er godkjent ✅</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Velkommen til Innovena. Fra nå av mottar dere matchende leads rett i pipelinen.
    </p>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">For å komme i gang:</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#404040;font-size:15px;line-height:1.7;">
      <li>Sjekk at tjenestekategoriene dere tilbyr er lagt til</li>
      <li>Legg inn konsulenter hvis aktuelt</li>
      <li>Start abonnementet for å låse opp leads</li>
    </ul>
    ${button("Til dashbord", url)}
  `;
  return {
    subject: `${input.tenant_name} er godkjent på Innovena`,
    html: shell(content),
    text: `${input.tenant_name} er godkjent. Gå til dashbordet: ${url}`,
  };
}

// =============================================================================
// Invoice sent to customer
// =============================================================================
export function tplInvoiceSent(input: {
  tenant_name: string;
  project_title: string | null;
  total_nok: number;
  payment_url: string;
}): Template {
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Ny faktura fra ${input.tenant_name}</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      ${input.project_title ? `Prosjekt: <em>${input.project_title}</em><br/>` : ""}
      Beløp: <strong>${nok(input.total_nok)}</strong>
    </p>
    ${button("Betal fakturaen", input.payment_url)}
    <p style="margin:16px 0 0;color:#737373;font-size:13px;">Trygg betaling med kort via Stripe. Kvittering kommer på e-post etter betaling.</p>
  `;
  return {
    subject: `Faktura fra ${input.tenant_name}: ${nok(input.total_nok)}`,
    html: shell(content),
    text: `Faktura fra ${input.tenant_name}${input.project_title ? ` (${input.project_title})` : ""}: ${nok(input.total_nok)}\n\nBetal: ${input.payment_url}`,
  };
}

// =============================================================================
// Magic link (after public inquiry submission, or admin-triggered)
// =============================================================================
export function tplMagicLink(input: {
  project_title?: string;
  action_link: string;
}): Template {
  const subjectSuffix = input.project_title ? ` · ${input.project_title}` : "";
  const body = input.project_title
    ? `<p style="margin:0 0 12px;color:#404040;font-size:15px;line-height:1.5;">
         Forespørselen din om <em>${input.project_title}</em> er registrert.
         Matchende byråer mottar den nå.
       </p>
       <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
         Klikk lenken under for å logge inn og følge med på tilbudene som
         kommer inn.
       </p>`
    : `<p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
         Klikk lenken under for å logge inn på Innovena.
       </p>`;
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Din innloggingslenke 🔑</h1>
    ${body}
    ${button("Logg inn", input.action_link)}
    <p style="margin:16px 0 0;color:#737373;font-size:13px;">
      Lenken fungerer én gang. Be om ny på innloggingssiden om nødvendig.
    </p>
  `;
  return {
    subject: `Din innloggingslenke til Innovena${subjectSuffix}`,
    html: shell(content),
    text: `Logg inn på Innovena: ${input.action_link}\n\nLenken fungerer én gang.`,
  };
}

// =============================================================================
// Invoice paid
// =============================================================================
export function tplInvoicePaid(input: {
  customer_name: string;
  project_title: string | null;
  amount_nok: number;
}): Template {
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">💰 Betaling mottatt</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      <strong>${input.customer_name}</strong> betalte fakturaen${input.project_title ? ` for <em>${input.project_title}</em>` : ""}.
    </p>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">Beløp: <strong>${nok(input.amount_nok)}</strong></p>
  `;
  return {
    subject: `💰 Betaling mottatt: ${nok(input.amount_nok)}`,
    html: shell(content),
    text: `${input.customer_name} betalte fakturaen. Beløp: ${nok(input.amount_nok)}`,
  };
}

// =============================================================================
// Tenant rejected
// =============================================================================
export function tplTenantRejected(input: { tenant_name: string }): Template {
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Søknaden for ${input.tenant_name} ble avslått</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Vi har dessverre valgt å ikke ta inn ${input.tenant_name} som partner på Innovena nå.
      Det kan skyldes kapasitet i regionen, kategorioverlapp eller andre forhold vi vurderer løpende.
    </p>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Har du spørsmål, svar direkte på denne e-posten så går vi gjennom vurderingen.
    </p>
  `;
  return {
    subject: `${input.tenant_name}: søknadsvurdering`,
    html: shell(content),
    text: `${input.tenant_name} ble dessverre ikke tatt inn på Innovena nå. Svar på denne e-posten for spørsmål.`,
  };
}

// =============================================================================
// Tenant suspended
// =============================================================================
export function tplTenantSuspended(input: { tenant_name: string }): Template {
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Kontoen for ${input.tenant_name} er midlertidig pauset</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Vi har pauset kontoen deres midlertidig. I pauseperioden mottar dere ikke nye leads,
      men eksisterende prosjekter fortsetter som normalt.
    </p>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Svar på denne e-posten så avklarer vi videre.
    </p>
  `;
  return {
    subject: `${input.tenant_name}: konto pauset`,
    html: shell(content),
    text: `${input.tenant_name}-kontoen er midlertidig pauset. Svar på denne e-posten for avklaring.`,
  };
}

// =============================================================================
// New tenant pending — admin notification
// =============================================================================
export function tplNewTenantPending(input: {
  tenant_name: string;
  tenant_type: string;
  owner_email: string;
}): Template {
  const url = `${baseUrl()}/admin/byraaer`;
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">🆕 Nytt byrå venter godkjenning</h1>
    <p style="margin:0 0 8px;color:#404040;font-size:15px;line-height:1.5;">
      <strong>${input.tenant_name}</strong> (${input.tenant_type}) registrerte seg akkurat.
    </p>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Eier: ${input.owner_email}
    </p>
    ${button("Gjennomgå og godkjenn", url)}
  `;
  return {
    subject: `Nytt byrå: ${input.tenant_name}`,
    html: shell(content),
    text: `${input.tenant_name} (${input.tenant_type}) venter godkjenning. Eier: ${input.owner_email}. Gjennomgå: ${url}`,
  };
}

// =============================================================================
// Project received — customer confirmation
// =============================================================================
export function tplProjectReceived(input: {
  project_title: string;
  project_id: string;
}): Template {
  const url = `${baseUrl()}/kunde/prosjekter/${input.project_id}`;
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Forespørselen din er registrert ✅</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      <em>${input.project_title}</em> er nå sendt til matchende byråer. De første tilbudene
      kommer vanligvis innen noen timer til én dag.
    </p>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Du får en e-post så snart et byrå sender et tilbud. Du kan følge med og sammenlikne
      tilbud i dashbordet.
    </p>
    ${button("Se prosjektet", url)}
  `;
  return {
    subject: `Forespørselen er registrert: ${input.project_title}`,
    html: shell(content),
    text: `Forespørselen din om ${input.project_title} er registrert og sendt til matchende byråer. Se: ${url}`,
  };
}

// =============================================================================
// Payment receipt — customer confirmation after paying invoice
// =============================================================================
export function tplPaymentReceipt(input: {
  tenant_name: string;
  amount_nok: number;
  project_title: string | null;
  paid_at: string;
}): Template {
  const paidDate = new Date(input.paid_at).toLocaleDateString("nb-NO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Kvittering for betaling</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Takk! Din betaling til <strong>${input.tenant_name}</strong> er mottatt.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0;width:100%;background:#fafafa;border-radius:6px;padding:12px;">
      ${input.project_title ? `<tr><td style="padding:8px 12px;font-size:14px;color:#525252;">Prosjekt</td><td style="padding:8px 12px;font-size:14px;text-align:right;">${input.project_title}</td></tr>` : ""}
      <tr><td style="padding:8px 12px;font-size:14px;color:#525252;${input.project_title ? "border-top:1px solid #e5e5e5;" : ""}">Beløp</td><td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:600;${input.project_title ? "border-top:1px solid #e5e5e5;" : ""}">${nok(input.amount_nok)}</td></tr>
      <tr><td style="padding:8px 12px;font-size:14px;color:#525252;border-top:1px solid #e5e5e5;">Betalt</td><td style="padding:8px 12px;font-size:14px;text-align:right;border-top:1px solid #e5e5e5;">${paidDate}</td></tr>
    </table>
    <p style="margin:16px 0 0;color:#737373;font-size:13px;">
      Denne e-posten er din bekreftelse. Du får også en Stripe-kvittering med alle detaljer.
    </p>
  `;
  return {
    subject: `Kvittering: ${nok(input.amount_nok)} til ${input.tenant_name}`,
    html: shell(content),
    text: `Betaling på ${nok(input.amount_nok)} til ${input.tenant_name} er mottatt ${paidDate}.`,
  };
}

// =============================================================================
// Subscription activated — tenant can receive leads
// =============================================================================
export function tplSubscriptionActivated(input: {
  tenant_name: string;
}): Template {
  const url = `${baseUrl()}/byraa`;
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Abonnementet er aktivt 🚀</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Abonnementet for <strong>${input.tenant_name}</strong> er nå aktivt. Matchende
      leads vil tikke inn i pipelinen etter hvert som kunder submitter forespørsler.
    </p>
    ${button("Til dashbord", url)}
  `;
  return {
    subject: `${input.tenant_name}: abonnement aktivt`,
    html: shell(content),
    text: `Abonnementet for ${input.tenant_name} er aktivt. Gå til dashbordet: ${url}`,
  };
}

// =============================================================================
// Subscription canceled
// =============================================================================
export function tplSubscriptionCanceled(input: {
  tenant_name: string;
  period_end: string | null;
}): Template {
  const endDate = input.period_end
    ? new Date(input.period_end).toLocaleDateString("nb-NO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const url = `${baseUrl()}/byraa/abonnement`;
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Abonnementet er sagt opp</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Abonnementet for <strong>${input.tenant_name}</strong> er kansellert.
      ${endDate ? `Dere har tilgang til leads frem til <strong>${endDate}</strong>.` : ""}
    </p>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Ombestem dere? Dere kan aktivere abonnementet på nytt når som helst.
    </p>
    ${button("Aktiver igjen", url)}
  `;
  return {
    subject: `${input.tenant_name}: abonnement kansellert`,
    html: shell(content),
    text: `Abonnementet for ${input.tenant_name} er kansellert.${endDate ? ` Tilgang frem til ${endDate}.` : ""} Aktiver igjen: ${url}`,
  };
}

// =============================================================================
// Subscription past due — payment failed
// =============================================================================
export function tplSubscriptionPastDue(input: {
  tenant_name: string;
}): Template {
  const url = `${baseUrl()}/byraa/abonnement`;
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">⚠️ Betaling feilet</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      Stripe klarte ikke å belaste kortet for <strong>${input.tenant_name}</strong>.
      Leads pauses til betalingen er på plass.
    </p>
    ${button("Oppdater betalingsmetode", url)}
  `;
  return {
    subject: `⚠️ ${input.tenant_name}: betaling feilet`,
    html: shell(content),
    text: `Stripe klarte ikke å belaste kortet for ${input.tenant_name}. Oppdater: ${url}`,
  };
}

// =============================================================================
// New contact (via webhook/embed form) — notify tenant
// =============================================================================
export function tplNewContactWebhook(input: {
  contact_name: string;
  source: string;
  contact_id: string;
}): Template {
  const url = `${baseUrl()}/byraa/kontakter`;
  const content = `
    <h1 style="margin:0 0 8px;font-size:20px;">Ny lead via ${input.source}</h1>
    <p style="margin:0 0 16px;color:#404040;font-size:15px;line-height:1.5;">
      <strong>${input.contact_name}</strong> kom akkurat inn gjennom skjemaet
      og ligger i første pipeline-stadium.
    </p>
    ${button("Åpne kontakter", url)}
  `;
  return {
    subject: `Ny lead: ${input.contact_name}`,
    html: shell(content, `Kom inn via ${input.source}`),
    text: `${input.contact_name} kom inn via ${input.source}. Åpne: ${url}`,
  };
}
