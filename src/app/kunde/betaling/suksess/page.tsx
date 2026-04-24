import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BetalingSuksessPage() {
  return (
    <div className="mx-auto max-w-md p-8">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
            <Check className="h-6 w-6 text-brand" />
          </div>
          <CardTitle>Takk for betalingen!</CardTitle>
          <CardDescription>
            Betalingen er registrert. Du kan nå følge prosjektet videre i
            dashbordet.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild variant="brand">
            <Link href="/kunde/prosjekter">Til prosjektene mine</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
