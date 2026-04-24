"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";

export function NewConsultantButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/consultants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          full_name: fullName,
          title: title || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Kunne ikke opprette");
        return;
      }
      router.push(`/byraa/konsulenter/${body.consultant.id}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Legg til konsulent
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="space-y-4">
          <div>
            <DialogTitle>Ny konsulent</DialogTitle>
            <DialogDescription>
              Opprett grunnprofilen, så redigerer du resten etter.
            </DialogDescription>
          </div>
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="nc-name">Fullt navn</Label>
              <Input
                id="nc-name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc-title">Tittel (valgfritt)</Label>
              <Input
                id="nc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="F.eks. Senior frontendutvikler"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Avbryt
              </Button>
              <Button type="submit" variant="brand" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Oppretter…
                  </>
                ) : (
                  "Opprett og rediger"
                )}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </>
  );
}
