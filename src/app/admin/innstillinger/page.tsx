import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminInnstillingerPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Innstillinger</h2>
      <Card>
        <CardHeader>
          <CardTitle>Plattforminnstillinger</CardTitle>
          <CardDescription>
            Global konfigurasjon, priser, leads-cap per kategori. Kommer i fase 6.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
