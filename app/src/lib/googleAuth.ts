import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle(): Promise<{
  error: string | null;
  cancelled: boolean;
}> {
  try {
    const redirectTo = AuthSession.makeRedirectUri();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });

    if (error) return { error: error.message, cancelled: false };
    if (!data.url) return { error: "Unable to start Google sign-in.", cancelled: false };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") {
      return { error: null, cancelled: true };
    }

    const callbackUrl = new URL(result.url);
    const query = callbackUrl.searchParams;
    const hash = new URLSearchParams(callbackUrl.hash.slice(1));
    const authError = query.get("error_description") ?? hash.get("error_description");
    if (authError) return { error: authError, cancelled: false };

    const code = query.get("code");
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      return { error: exchangeError?.message ?? null, cancelled: false };
    }

    const accessToken = hash.get("access_token") ?? query.get("access_token");
    const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");
    if (!accessToken || !refreshToken) {
      return { error: "Google sign-in did not return a valid session.", cancelled: false };
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return { error: sessionError?.message ?? null, cancelled: false };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Google sign-in failed.",
      cancelled: false,
    };
  }
}