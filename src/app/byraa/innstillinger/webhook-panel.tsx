"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "embed" | "api" | "html";

export function WebhookPanel({
  webhookKey: initialKey,
  appUrl,
}: {
  webhookKey: string;
  appUrl: string;
}) {
  const router = useRouter();
  const [webhookKey, setWebhookKey] = useState(initialKey);
  const [tab, setTab] = useState<Tab>("embed");
  const [rotating, setRotating] = useState(false);

  const embedUrl = `${appUrl}/forms/${webhookKey}`;
  const apiUrl = `${appUrl}/api/public/leads?key=${webhookKey}`;
  const contactsUrl = `${appUrl}/api/public/contacts?key=${webhookKey}`;

  async function rotate() {
    if (
      !confirm(
        "Rotere nøkkelen? Alle eksisterende integrasjoner slutter å virke og må oppdateres.",
      )
    )
      return;
    setRotating(true);
    try {
      const res = await fetch("/api/tenant/webhook-rotate", { method: "POST" });
      const body = await res.json();
      if (res.ok && body.webhook_key) {
        setWebhookKey(body.webhook_key);
        router.refresh();
      }
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {(
          [
            { value: "embed", label: "Hostet skjema" },
            { value: "html", label: "HTML-form på egen side" },
            { value: "api", label: "API / webhook" },
          ] as { value: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs transition-colors",
              tab === t.value
                ? "border-brand bg-brand/5"
                : "border-border hover:border-foreground/30",
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={rotate}
            disabled={rotating}
          >
            <RefreshCw className={cn("h-3 w-3", rotating && "animate-spin")} />
            Rotér nøkkel
          </Button>
        </div>
      </div>

      {tab === "embed" ? (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Lim inn lenken eller iframe-koden på nettsiden deres. Alle
            innsendinger lander i første pipeline-stadium.
          </p>
          <CopyRow label="Lenke" value={embedUrl} />
          <CopyRow
            label="iframe-embed"
            value={`<iframe src="${embedUrl}" width="100%" height="600" style="border:0"></iframe>`}
            multiline
          />
        </div>
      ) : tab === "html" ? (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Bruk dette HTML-snippet hvis dere vil ha skjemaet i egen design. Det
            POSTer direkte til webhooken vår.
          </p>
          <CopyRow
            label="HTML"
            value={HTML_FORM_SNIPPET(apiUrl)}
            multiline
          />
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Bruk via Zapier, n8n eller eget backend-system. Feltene er
            valgfrie; oppgi minst <code>full_name</code>, <code>email</code>{" "}
            eller <code>phone</code>.
          </p>
          <CopyRow
            label="Opprett lead (+ kontakt + pipeline-kort)"
            value={apiUrl}
          />
          <CopyRow
            label="Kun kontakt (ingen pipeline-kort)"
            value={contactsUrl}
          />
          <CopyRow
            label="curl-eksempel"
            value={CURL_EXAMPLE(apiUrl)}
            multiline
          />
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <strong>Sikkerhet:</strong> Nøkkelen er et passord — ikke legg den ut i
        offentlig kildekode hvis du kan unngå det. For HTML-formet er
        eksponering akseptabel siden det er samme nøkkel alle kunder som
        submitter skjemaet bruker. Rotér om du mistenker misbruk.
      </div>
    </div>
  );
}

function CopyRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex gap-2">
        {multiline ? (
          <pre className="flex-1 overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
            {value}
          </pre>
        ) : (
          <code className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs break-all">
            {value}
          </code>
        )}
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
    </div>
  );
}

function HTML_FORM_SNIPPET(apiUrl: string): string {
  return `<form id="lead-form">
  <input name="full_name" placeholder="Navn" required>
  <input name="email" type="email" placeholder="E-post" required>
  <input name="phone" placeholder="Telefon">
  <input name="company" placeholder="Selskap">
  <textarea name="message" placeholder="Melding"></textarea>
  <button type="submit">Send inn</button>
</form>
<script>
document.getElementById('lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const res = await fetch('${apiUrl}', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.ok) e.target.reset();
});
</script>`;
}

function CURL_EXAMPLE(apiUrl: string): string {
  return `curl -X POST '${apiUrl}' \\
  -H 'content-type: application/json' \\
  -d '{
    "full_name": "Ola Nordmann",
    "email": "ola@example.com",
    "phone": "+4790000000",
    "company": "Acme AS",
    "message": "Trenger hjelp med SEO",
    "value_nok": 50000
  }'`;
}
