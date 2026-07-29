import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";
import type { Session } from "@supabase/supabase-js";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileError: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  loading: true,
  profileError: null,

  initialize: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session });
    if (data.session) {
      await fetchProfile(data.session.user.id, set);
    }
    set({ loading: false });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session });
      if (session) {
        await fetchProfile(session.user.id, set);
      } else {
        set({ profile: null, profileError: null });
      }
    });
  },

  signIn: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, profileError: null });
  },
}));

async function fetchProfile(
  userId: string,
  set: (partial: Partial<AuthState>) => void
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!error && data) {
    set({ profile: data as Profile, profileError: null });
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
    });
    return;
  }

  const retry = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (!retry.error && retry.data) {
    set({ profile: retry.data as Profile, profileError: null });
  } else {
    set({
      profile: null,
      profileError: "Account setup couldn't be completed. Contact your institution's admin.",
    });
  }
}