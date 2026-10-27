import { SocialLogin } from "@capgo/capacitor-social-login";
import { supabase } from "@/lib/supabaseClient";

let initializePromise: Promise<void> | null = null;

function initializeGoogleLogin() {
  const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID?.trim();
  if (!webClientId) {
    throw new Error(
      "Native Google sign-in needs the VITE_GOOGLE_WEB_CLIENT_ID value configured for this Android build.",
    );
  }

  if (!initializePromise) {
    initializePromise = SocialLogin.initialize({
      google: {
        webClientId,
        mode: "online",
      },
    }).catch((error: unknown) => {
      initializePromise = null;
      throw error;
    });
  }

  return initializePromise;
}

async function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const rawNonce = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawNonce));
  const hashedNonce = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");

  return { rawNonce, hashedNonce };
}

export async function signInWithNativeGoogle() {
  await initializeGoogleLogin();

  const { rawNonce, hashedNonce } = await createNonce();
  const { result } = await SocialLogin.login({
    provider: "google",
    options: {
      scopes: ["openid", "email", "profile"],
      nonce: hashedNonce,
      style: "bottom",
      filterByAuthorizedAccounts: false,
      autoSelectEnabled: false,
    },
  });

  if (result.responseType !== "online" || !result.idToken) {
    throw new Error("Google did not return an identity token. Please try again.");
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: result.idToken,
    nonce: rawNonce,
  });

  if (error) throw error;
}
