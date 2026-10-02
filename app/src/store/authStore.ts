import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";
import type { Session, User } from "@supabase/supabase-js";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  profileSetupRequired: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,
  profileError: null,
  profileSetupRequired: false,

  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session });
    if (data.session) {
      await fetchProfile(data.session.user, set);
    }
    set({ loading: false });

    supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session });
      if (session) {
        if (event === "USER_UPDATED" && get().profileSetupRequired) return;
        await fetchProfile(session.user, set);
      } else {
        set({ profile: null, profileError: null, profileSetupRequired: false });
      }
    });
  },

  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },

  refreshProfile: async () => {
    const session = get().session;
    if (!session) return "No active session.";

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error || !data) {
      const message = error?.message ?? "Account setup couldn't be completed.";
      set({ profile: null, profileError: message, profileSetupRequired: true });
      return message;
    }

    set({ profile: data as Profile, profileError: null, profileSetupRequired: false });
    return null;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, profileError: null, profileSetupRequired: false });
  },
}));

async function fetchProfile(
  user: User,
  set: (partial: Partial<AuthState>) => void
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!error && data) {
    set({ profile: data as Profile, profileError: null, profileSetupRequired: false });
    return;
  }

  if (error?.code === "PGRST116" && !user.user_metadata?.invite_code) {
    set({ profile: null, profileError: null, profileSetupRequired: true });
    return;
  }

  // No profile row yet — this is the expected state right after a
  // self-signed-up user confirms their email and logs in for the first
  // time. Complete their profile using the invite-code metadata stored
  // at signup, then retry the fetch once.
  const { error: rpcError } = await supabase.rpc("complete_signup_profile");

  if (rpcError) {
    set({
      profile: null,
      profileError: rpcError.message,
      profileSetupRequired: false,
    });
    return;
  }

  const retry = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!retry.error && retry.data) {
    set({ profile: retry.data as Profile, profileError: null, profileSetupRequired: false });
  } else {
    set({
      profile: null,
      profileError: "Account setup couldn't be completed. Contact your institution's admin.",
      profileSetupRequired: false,
    });
  }
}