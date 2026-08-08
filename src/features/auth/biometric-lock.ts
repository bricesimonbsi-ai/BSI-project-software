const PREFIX = "biometric-lock";

function credentialKey(userId: string) {
  return `${PREFIX}:credential:${userId}`;
}

function enabledKey(userId: string) {
  return `${PREFIX}:enabled:${userId}`;
}

/** Clé sessionStorage (pas localStorage : on veut re-demander Face ID/Touch ID à chaque
 * réouverture de l'app, pas seulement à la première connexion). */
export function unlockedKey(userId: string) {
  return `${PREFIX}:unlocked:${userId}`;
}

// Cast en BufferSource : sur les typings TS récents, Uint8Array est générique sur
// ArrayBufferLike (qui inclut SharedArrayBuffer), ce qui le rend incompatible par défaut avec
// les API WebAuthn typées pour un ArrayBuffer concret — sans incidence réelle ici puisque
// crypto.getRandomValues ne produit jamais de SharedArrayBuffer.
function randomBytes(length: number): BufferSource {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes as BufferSource;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function base64ToBuffer(base64: string): ArrayBuffer {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

/** Un authentificateur biométrique de la plateforme (Face ID, Touch ID, empreinte Android...)
 * est-il disponible sur cet appareil/navigateur ? */
export async function isBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricLockEnabled(userId: string): boolean {
  return localStorage.getItem(enabledKey(userId)) === "true" && !!localStorage.getItem(credentialKey(userId));
}

/**
 * Verrou LOCAL uniquement : la biométrie ne remplace pas la connexion Supabase (email/mot de
 * passe), elle protège l'accès à une session déjà ouverte sur cet appareil — comme le
 * déverrouillage d'une appli bancaire. Le challenge/la clé WebAuthn ne sont jamais envoyés à un
 * serveur ; ils servent uniquement à faire réussir/échouer localement la cérémonie biométrique
 * du navigateur (aucun serveur de vérification à opérer pour ce niveau de protection).
 */
export async function enableBiometricLock(userId: string, email: string, displayName: string): Promise<void> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      rp: { name: "Portefeuille de projets" },
      user: { id: randomBytes(16), name: email, displayName: displayName || email },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Échec de la création de la clé biométrique.");

  localStorage.setItem(credentialKey(userId), bufferToBase64(credential.rawId));
  localStorage.setItem(enabledKey(userId), "true");
}

export function disableBiometricLock(userId: string): void {
  localStorage.removeItem(credentialKey(userId));
  localStorage.removeItem(enabledKey(userId));
  sessionStorage.removeItem(unlockedKey(userId));
}

/** Déclenche la cérémonie Face ID/Touch ID ; résout à true seulement si l'authentification
 * biométrique a réellement réussi (sinon la promesse rejette ou l'utilisateur annule). */
export async function verifyBiometricUnlock(userId: string): Promise<boolean> {
  const storedId = localStorage.getItem(credentialKey(userId));
  if (!storedId) return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ id: base64ToBuffer(storedId), type: "public-key" }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}
