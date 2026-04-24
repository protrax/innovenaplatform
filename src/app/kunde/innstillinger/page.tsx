import { requireUser } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function KundeInnstillinger() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Innstillinger</h2>
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Oppdatering av navn, telefon og faktureringsinfo kommer i neste fase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>E-post</Label>
            <Input value={user.email} readOnly />
          </div>
          <div className="space-y-2">
            <Label>Navn</Label>
            <Input value={user.fullName ?? ""} readOnly />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
