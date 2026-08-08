import { useEffect, useState } from "react";
import { useAuth } from "@/app/providers/auth-provider";
import { verifyBiometricUnlock } from "@/features/auth/biometric-lock";
import { Button } from "@/components/ui/button";
import { Fingerprint } from "lucide-react";

/** Écran plein écran affiché tant que l'app n'a pas été déverrouillée par biométrie sur cet
 * appareil — tente automatiquement la vérification à l'ouverture, avec un bouton "Réessayer" et
 * une échappatoire "Se déconnecter" en cas d'échec répété ou d'annulation. */
export function BiometricLockScreen({ userId, onUnlock }: { userId: string; onUnlock: () => void }) {
  const { signOut } = useAuth();
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);

  async function attempt() {
    setVerifying(true);
    setFailed(false);
    const ok = await verifyBiometricUnlock(userId);
    setVerifying(false);
    if (ok) onUnlock();
    else setFailed(true);
  }

  useEffect(() => {
    attempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="rounded-full bg-accent/15 p-5 text-accent">
        <Fingerprint className="h-10 w-10" />
      </div>
      <div>
        <p className="text-lg font-semibold">Application verrouillée</p>
        <p className="text-sm text-muted-foreground">
          {failed ? "Vérification biométrique annulée ou échouée." : "Déverrouille avec Face ID / Touch ID pour continuer."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={attempt} disabled={verifying}>
          {verifying ? "Vérification..." : "Réessayer"}
        </Button>
        <Button variant="outline" onClick={() => signOut()}>
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
