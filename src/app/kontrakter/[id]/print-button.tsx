"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.print()}
    >
      <Printer className="h-4 w-4" /> Skriv ut / lagre PDF
    </Button>
  );
}
