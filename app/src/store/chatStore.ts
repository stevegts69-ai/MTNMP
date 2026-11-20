import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChatProfile } from "../lib/chat";
import { supabase } from "../lib/supabase";

interface ChatState {
  unreadByChannel: Record<string, number>;
  activeChannelId: string | null;
  setUnreadCounts: (counts: Record<string, number>) => void;
  setActiveChannel: (channelId: string | null) => void;
  markRead: (channelId: string, userId: string) => Promise<void>;
  startUnreadTracking: (profile: ChatProfile) => Promise<void>;
  stopUnreadTracking: () => void;
}

let unreadSubscription: RealtimeChannel | null = null;

export const useChatStore = create<ChatState>((set, get) => ({
  unreadByChannel: {},
  activeChannelId: null,

  setUnreadCounts: (unreadByChannel) => set({ unreadByChannel }),

  setActiveChannel: (activeChannelId) => set({ activeChannelId }),

  markRead: async (channelId, userId) => {
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("chat_members")
      .update({ last_read_at: readAt })
      .eq("channel_id", channelId)
      .eq("user_id", userId);

    if (!error) {
      set((state) => ({
        unreadByChannel: { ...state.unreadByChannel, [channelId]: 0 },
      }));
    }
  },

  stopUnreadTracking: () => {
    if (unreadSubscription) {
      void supabase.removeChannel(unreadSubscription);
      unreadSubscription = null;
    }
  },

  startUnreadTracking: async (profile) => {
    get().stopUnreadTracking();
    if (!profile.credential_verified || !profile.is_active) {
      set({ unreadByChannel: {} });
      return;
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("chat_members")
      .select("channel_id, last_read_at")
      .eq("user_id", profile.id)
      .eq("institution_id", profile.institution_id);

    if (membershipError) {
      set({ unreadByChannel: {} });
      return;
    }

    const memberRows = memberships ?? [];
    const channelIds = memberRows.map((row) => row.channel_id as string);
    if (channelIds.length === 0) {
      set({ unreadByChannel: {} });
      return;
    }

    const realtimeDeltas: Record<string, number> = {};
    let channel = supabase.channel(`chat-unread:${profile.id}`);
    for (const channelId of channelIds) {
      channel = channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const message = payload.new as { channel_id: string; sender_id: string };
          if (message.sender_id === profile.id) return;
          if (get().activeChannelId === channelId) {
            void get().markRead(channelId, profile.id);
            return;
          }
          realtimeDeltas[channelId] = (realtimeDeltas[channelId] ?? 0) + 1;
          set((state) => ({
            unreadByChannel: {
              ...state.unreadByChannel,
              [channelId]: (state.unreadByChannel[channelId] ?? 0) + 1,
            },
          }));
        }
      );
    }
    unreadSubscription = channel.subscribe();

    const unreadEntries = await Promise.all(
      memberRows.map(async (membership) => {
        const { count, error } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", membership.channel_id)
          .gt("created_at", membership.last_read_at)
          .neq("sender_id", profile.id);
        return [membership.channel_id as string, error ? 0 : count ?? 0] as const;
      })
    );
    set({
      unreadByChannel: Object.fromEntries(
        unreadEntries.map(([channelId, count]) => [
          channelId,
          get().activeChannelId === channelId ? 0 : count + (realtimeDeltas[channelId] ?? 0),
        ])
      ),
    });
  },
}));