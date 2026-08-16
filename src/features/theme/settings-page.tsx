import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-provider";
import { useThemeStore, type ThemeMode, type CategoryLayout } from "@/features/theme/theme-store";
import { THEME_PRESETS } from "@/features/theme/theme-presets";
import { isBiometricAvailable, isBiometricLockEnabled, enableBiometricLock, disableBiometricLock } from "@/features/auth/biometric-lock";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Sun, Moon, Monitor, Shapes, Users, UserCog, Check, List, LayoutGrid, Circle, Fingerprint, Bell } from "lucide-react";

const modes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
];

const categoryLayouts: { value: CategoryLayout; label: string; icon: typeof List }[] = [
  { value: "list", label: "Liste", icon: List },
  { value: "grid", label: "Grille", icon: LayoutGrid },
  { value: "circle", label: "Cercles", icon: Circle },
];

export function SettingsPage() {
  const { profile } = useAuth();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const themePreset = useThemeStore((s) => s.themePreset);
  const setThemePreset = useThemeStore((s) => s.setThemePreset);
  const categoryLayout = useThemeStore((s) => s.categoryLayout);
  const setCategoryLayout = useThemeStore((s) => s.setCategoryLayout);

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
          <CardTitle>Disposition des catégories</CardTitle>
          <CardDescription>La façon dont la liste des catégories de projets s'affiche sur la page d'accueil.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          {categoryLayouts.map((l) => (
            <Button
              key={l.value}
              variant={categoryLayout === l.value ? "default" : "outline"}
              onClick={() => setCategoryLayout(l.value)}
              className="flex-1"
            >
              <l.icon className="mr-2 h-4 w-4" /> {l.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <BiometricLockSetting />

      {profile?.is_admin && (
        <Card>
          <CardHeader>
            <CardTitle>Administration</CardTitle>
            <CardDescription>
              Gestion des catégories de projets, des personnes et de leurs accès, et des notifications reçues.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link to="/categories">
              <Button variant="outline">
                <Shapes className="mr-2 h-4 w-4" /> Gérer les catégories
              </Button>
            </Link>
            <Link to="/people">
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" /> Gérer les personnes et avatars
              </Button>
            </Link>
            <Link to="/collaborators">
              <Button variant="outline">
                <UserCog className="mr-2 h-4 w-4" /> Gérer les accès
              </Button>
            </Link>
            <Link to="/settings/notifications">
              <Button variant="outline">
                <Bell className="mr-2 h-4 w-4" /> Gérer les notifications
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Verrou LOCAL par biométrie (Face ID/Touch ID/empreinte) : protège l'accès à une session déjà
 * ouverte sur cet appareil, en plus de la connexion Supabase habituelle — ne s'affiche que si un
 * authentificateur de la plateforme est disponible (téléphone/ordinateur récent, HTTPS). */
function BiometricLockSetting() {
  const { session, profile } = useAuth();
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setAvailable);
  }, []);

  useEffect(() => {
    if (session) setEnabled(isBiometricLockEnabled(session.user.id));
  }, [session]);

  if (!available || !session) return null;

  async function handleToggle(next: boolean) {
    if (!session) return;
    setBusy(true);
    try {
      if (next) {
        await enableBiometricLock(session.user.id, session.user.email ?? "", profile?.display_name ?? "");
        setEnabled(true);
        toast({ title: "Verrouillage biométrique activé" });
      } else {
        disableBiometricLock(session.user.id);
        setEnabled(false);
      }
    } catch (err) {
      toast({ title: "Erreur", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verrouillage biométrique</CardTitle>
        <CardDescription>
          Demande Face ID / Touch ID / empreinte à chaque ouverture de l'application, en plus de ta connexion habituelle.
          Purement local à cet appareil — ne remplace pas ta connexion.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant={enabled ? "outline" : "default"} onClick={() => handleToggle(!enabled)} disabled={busy}>
          <Fingerprint className="mr-2 h-4 w-4" /> {enabled ? "Désactiver" : "Activer"}
        </Button>
      </CardContent>
    </Card>
  );
}
