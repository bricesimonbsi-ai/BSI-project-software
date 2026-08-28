import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/** Page atteinte en cliquant sur le lien d'un email d'invitation (supabase.auth.admin.inviteUserByEmail) :
 * la session est déjà établie à ce stade (le SDK Supabase détecte les jetons dans l'URL), il ne
 * reste qu'à faire choisir un mot de passe pour que la personne puisse se reconnecter ensuite. */
export function AcceptInvitePage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/", { replace: true });
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement...</div>;
  }

  // Lien expiré ou déjà utilisé : pas de session établie, on renvoie vers la connexion normale.
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-secondary/40 p-4 dark:bg-background dark:bg-[radial-gradient(circle_at_50%_32%,_hsl(250_45%_20%),_transparent_60%)]">
      <div className="relative flex items-center gap-2 text-xl font-bold">
        <div className="absolute -inset-4 -z-10 rounded-full bg-accent/30 blur-2xl dark:bg-accent/40" aria-hidden="true" />
        <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
        Projeko
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Bienvenue sur Projeko</CardTitle>
          <CardDescription>On t'a partagé un projet — choisis un mot de passe pour te connecter la prochaine fois.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Masqué visuellement (pas display:none, pour rester détectable par les gestionnaires
             * de mots de passe) : associe le nouveau mot de passe au bon compte, cette page n'ayant
             * pas de champ email visible (l'adresse est déjà connue via la session). */}
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={session.user.email ?? ""}
              readOnly
              className="absolute h-0 w-0 overflow-hidden opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            />
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                name="new-password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Enregistrement..." : "Continuer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
