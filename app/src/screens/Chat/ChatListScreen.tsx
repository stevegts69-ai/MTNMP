import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppTextInput from "../../components/AppTextInput";
import {
  getOrCreateGeneralChannel,
  type ChatChannel,
  type ChatStackParamList,
} from "../../lib/chat";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";

type Props = NativeStackScreenProps<ChatStackParamList, "ChatList">;

interface ChatListItem {
  channel: ChatChannel;
  title: string;
  preview: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface ChatSection {
  title: string;
  data: ChatListItem[];
}

function displayTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatListScreen({ navigation }: Props) {
  const profile = useAuthStore((state) => state.profile);
  const unreadByChannel = useChatStore((state) => state.unreadByChannel);
  const setUnreadCounts = useChatStore((state) => state.setUnreadCounts);
  const startUnreadTracking = useChatStore((state) => state.startUnreadTracking);
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    if (!profile.credential_verified || !profile.is_active) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);
    try {
      await getOrCreateGeneralChannel(profile);
      await startUnreadTracking(profile);

      const { data: memberships, error: membershipError } = await supabase
        .from("chat_members")
        .select("channel_id, last_read_at")
        .eq("user_id", profile.id)
        .eq("institution_id", profile.institution_id);
      if (membershipError) throw new Error("Unable to load your chat memberships.");

      const lastReadByChannel = new Map(
        (memberships ?? []).map((membership) => [
          membership.channel_id as string,
          membership.last_read_at as string,
        ])
      );
      const channelIds = [...lastReadByChannel.keys()];
      if (channelIds.length === 0) {
        setItems([]);
        setUnreadCounts({});
        return;
      }

      const { data: channels, error: channelError } = await supabase
        .from("chat_channels")
        .select("*")
        .in("id", channelIds)
        .eq("institution_id", profile.institution_id);
      if (channelError) throw new Error("Unable to load chat channels.");
      const channelRows = (channels ?? []) as ChatChannel[];

      const patientIds = channelRows
        .filter((channel) => channel.kind === "patient" && channel.patient_id)
        .map((channel) => channel.patient_id as string);
      const { data: patients, error: patientError } = patientIds.length
        ? await supabase.from("patients").select("id, full_name").in("id", patientIds)
        : { data: [], error: null };
      if (patientError) throw new Error("Unable to load patient thread names.");
      const patientNames = new Map(
        (patients ?? []).map((patient) => [patient.id as string, patient.full_name as string])
      );

      const directIds = channelRows
        .filter((channel) => channel.kind === "direct")
        .map((channel) => channel.id);
      const { data: directMembers, error: directMemberError } = directIds.length
        ? await supabase
            .from("chat_members")
            .select("channel_id, user_id")
            .in("channel_id", directIds)
        : { data: [], error: null };
      if (directMemberError) throw new Error("Unable to load direct-message members.");
      const colleagueIds = [...new Set(
        (directMembers ?? [])
          .map((member) => member.user_id as string)
          .filter((userId) => userId !== profile.id)
      )];
      const { data: colleagues, error: colleagueError } = colleagueIds.length
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .eq("institution_id", profile.institution_id)
            .in("id", colleagueIds)
        : { data: [], error: null };
      if (colleagueError) {
        throw new Error("Unable to read colleague names with the current profile access policy.");
      }
      if ((colleagues ?? []).length !== colleagueIds.length) {
        throw new Error("Unable to read colleague names with the current profile access policy.");
      }
      const colleagueNames = new Map(
        (colleagues ?? []).map((colleague) => [
          colleague.id as string,
          colleague.full_name as string,
        ])
      );
      const directNameByChannel = new Map<string, string>();
      for (const member of directMembers ?? []) {
        if (member.user_id === profile.id) continue;
        const name = colleagueNames.get(member.user_id as string);
        if (name) {
          const current = directNameByChannel.get(member.channel_id as string);
          directNameByChannel.set(
            member.channel_id as string,
            current ? `${current}, ${name}` : name
          );
        }
      }

      const listItems = await Promise.all(
        channelRows.map(async (channel): Promise<ChatListItem> => {
          const { data: latestMessage, error: latestError } = await supabase
            .from("chat_messages")
            .select("body, created_at")
            .eq("channel_id", channel.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latestError) throw new Error("Unable to load chat previews.");

          const { count, error: unreadError } = await supabase
            .from("chat_messages")
            .select("id", { count: "exact", head: true })
            .eq("channel_id", channel.id)
            .gt("created_at", lastReadByChannel.get(channel.id) ?? "1970-01-01T00:00:00.000Z")
            .neq("sender_id", profile.id);
          if (unreadError) throw new Error("Unable to load unread counts.");

          const title = channel.kind === "patient"
            ? patientNames.get(channel.patient_id ?? "") ?? "Patient thread"
            : channel.kind === "direct"
              ? directNameByChannel.get(channel.id) ?? "Direct message"
              : channel.name ?? "Team discussion";
          return {
            channel,
            title,
            preview: latestMessage?.body ?? "No messages yet",
            lastMessageAt: latestMessage?.created_at ?? null,
            unreadCount: count ?? 0,
          };
        })
      );

      setItems(listItems);
      setUnreadCounts(Object.fromEntries(listItems.map((item) => [item.channel.id, item.unreadCount])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load chat.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, setUnreadCounts, startUnreadTracking]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadChannels);
    return unsubscribe;
  }, [loadChannels, navigation]);

  const sections = useMemo<ChatSection[]>(() => [
    { title: "General", data: items.filter((item) => item.channel.kind === "team" && item.channel.name === "General") },
    { title: "Patient threads I've joined", data: items.filter((item) => item.channel.kind === "patient") },
    { title: "Direct messages", data: items.filter((item) => item.channel.kind === "direct") },
  ], [items]);

  if (!profile?.credential_verified || !profile.is_active) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg px-8">
        <Ionicons name="lock-closed-outline" size={28} color="#64748B" />
        <Text className="mt-3 text-center text-base font-semibold text-clinical-primary">
          Chat is available after credential verification.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  const totalItems = items.length;
  return (
    <View className="flex-1 bg-clinical-bg px-4 pt-3">
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate("ChatColleaguePicker", {})}
        className="mb-3 min-h-12 flex-row items-center justify-center gap-2 rounded-lg bg-clinical-primary px-4"
      >
        <Ionicons name="create-outline" size={18} color="#FFFFFF" />
        <Text className="font-semibold text-white">New direct message</Text>
      </Pressable>

      {error ? (
        <View className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <Text className="text-sm text-red-800">{error}</Text>
          <Pressable onPress={loadChannels} className="mt-2 self-start">
            <Text className="text-sm font-semibold text-clinical-primary">Try again</Text>
          </Pressable>
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.channel.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadChannels();
            }}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text className="mb-2 mt-4 text-xs font-bold uppercase text-gray-500">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("ChatThread", { channelId: item.channel.id })}
            className="mb-2 min-h-20 flex-row items-center rounded-lg border border-gray-200 bg-white px-4 py-3"
          >
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-clinical-primary/10">
              <Ionicons
                name={item.channel.kind === "patient" ? "person-outline" : item.channel.kind === "direct" ? "chatbubble-outline" : "people-outline"}
                size={19}
                color="#1E3A5F"
              />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text numberOfLines={1} className="flex-1 text-sm font-semibold text-gray-900">
                  {item.title}
                </Text>
                <Text className="ml-2 text-xs text-gray-500">{displayTime(item.lastMessageAt)}</Text>
              </View>
              <Text numberOfLines={1} className="mt-1 text-xs text-gray-500">{item.preview}</Text>
            </View>
            {(unreadByChannel[item.channel.id] ?? item.unreadCount) > 0 ? (
              <View className="ml-3 min-w-6 items-center rounded-full bg-emerald-700 px-2 py-1">
                <Text className="text-xs font-bold text-white">
                  {(unreadByChannel[item.channel.id] ?? item.unreadCount) > 99
                    ? "99+"
                    : unreadByChannel[item.channel.id] ?? item.unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          totalItems === 0 ? (
            <View className="items-center px-6 py-10">
              <Text className="text-sm text-gray-500">No conversations yet.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}