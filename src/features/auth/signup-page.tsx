import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signUp(email, password, displayName);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-secondary/40 p-4 dark:bg-background dark:bg-[radial-gradient(circle_at_50%_32%,_hsl(250_45%_20%),_transparent_60%)]">
        <div className="relative flex items-center gap-2 text-xl font-bold">
          <div className="absolute -inset-4 -z-10 rounded-full bg-accent/30 blur-2xl dark:bg-accent/40" aria-hidden="true" />
          <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
          Projeko
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Compte créé</CardTitle>
            <CardDescription>
              Si la confirmation par email est activée sur le projet Supabase, vérifie ta boîte mail avant de te
              connecter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/login")}>
              Aller à la connexion
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-secondary/40 p-4 dark:bg-background dark:bg-[radial-gradient(circle_at_50%_32%,_hsl(250_45%_20%),_transparent_60%)]">
      <div className="relative flex items-center gap-2 text-xl font-bold">
        <div className="absolute -inset-4 -z-10 rounded-full bg-accent/30 blur-2xl dark:bg-accent/40" aria-hidden="true" />
        <img src="/icons/icon-192.png" alt="" className="h-9 w-9 rounded-lg" />
        Projeko
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Créer un compte</CardTitle>
          <CardDescription>Le tout premier compte créé devient automatiquement administrateur.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nom affiché</Label>
              <Input
                id="displayName"
                name="name"
                autoComplete="name"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
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
              {submitting ? "Création..." : "Créer le compte"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link to="/login" className="text-primary underline underline-offset-4">
              Se connecter
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
