import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-provider";
import { useThemeStore, type ThemeMode } from "@/features/theme/theme-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, Shapes } from "lucide-react";

const modes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
];

export function SettingsPage() {
  const { profile } = useAuth();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Réglages</h1>

      <Card>
        <CardHeader>
          <CardTitle>Thème</CardTitle>
          <CardDescription>Mode clair, sombre, ou suivre le système. L'accent de couleur s'adapte à la catégorie consultée.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {modes.map((m) => (
            <Button
              key={m.value}
              variant={mode === m.value ? "default" : "outline"}
              onClick={() => setMode(m.value)}
              className={cn("flex-1")}
            >
              <m.icon className="mr-2 h-4 w-4" /> {m.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      {profile?.is_admin && (
        <Card>
          <CardHeader>
            <CardTitle>Administration</CardTitle>
            <CardDescription>Gestion des catégories de projets du portefeuille.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/categories">
              <Button variant="outline">
                <Shapes className="mr-2 h-4 w-4" /> Gérer les catégories
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
