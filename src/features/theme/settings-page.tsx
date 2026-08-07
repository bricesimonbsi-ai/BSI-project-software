import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-provider";
import { useThemeStore, type ThemeMode } from "@/features/theme/theme-store";
import { THEME_PRESETS } from "@/features/theme/theme-presets";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sun, Moon, Monitor, Shapes, Users, Check } from "lucide-react";

const modes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
];

export function SettingsPage() {
  const { profile } = useAuth();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const themePreset = useThemeStore((s) => s.themePreset);
  const setThemePreset = useThemeStore((s) => s.setThemePreset);

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

      <Card>
        <CardHeader>
          <CardTitle>Couleur du thème</CardTitle>
          <CardDescription>
            La couleur dominante de l'application (boutons, liens, focus...). Dans un projet, elle s'efface au profit de la
            couleur de la catégorie consultée.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setThemePreset(preset.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-md border px-3 py-2 transition",
                themePreset === preset.id ? "border-accent bg-accent/10" : "border-border/60 hover:border-border"
              )}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: preset.swatch }}
              >
                {themePreset === preset.id && <Check className="h-4 w-4 text-white" />}
              </span>
              <span className="text-xs text-muted-foreground">{preset.label}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personnes</CardTitle>
          <CardDescription>
            Une liste de personnes réutilisable sur tous tes projets (ex. les voyageurs d'un voyage).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/people">
            <Button variant="outline">
              <Users className="mr-2 h-4 w-4" /> Gérer les personnes
            </Button>
          </Link>
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
