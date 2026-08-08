import { useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/app/providers/auth-provider";
import { isBiometricLockEnabled, unlockedKey } from "@/features/auth/biometric-lock";
import { BiometricLockScreen } from "@/features/auth/biometric-lock-screen";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [unlocked, setUnlocked] = useState(false);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Chargement...</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  const userId = session.user.id;
  // sessionStorage (pas React state seul) : ProtectedRoute est remonté à chaque navigation entre
  // routes (une instance par <Route>), donc c'est la mémorisation en session qui évite de
  // redemander Face ID à chaque clic dans la nav — le state local ne sert qu'à débloquer
  // immédiatement l'écran courant sans attendre un re-render déclenché ailleurs.
  const locked = isBiometricLockEnabled(userId) && sessionStorage.getItem(unlockedKey(userId)) !== "true" && !unlocked;

  if (locked) {
    return (
      <BiometricLockScreen
        userId={userId}
        onUnlock={() => {
          sessionStorage.setItem(unlockedKey(userId), "true");
          setUnlocked(true);
        }}
      />
    );
  }

  return <>{children}</>;
}
