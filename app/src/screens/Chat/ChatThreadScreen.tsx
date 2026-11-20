import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppTextInput from "../../components/AppTextInput";
import type { ChatChannel, ChatMessage, ChatStackParamList } from "../../lib/chat";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";

type Props = NativeStackScreenProps<ChatStackParamList, "ChatThread">;

interface MessageRow {
  id: string;
  channel_id: string;
  institution_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

const PAGE_SIZE = 50;

function formatRole(role: string): string {
  const labels: Record<string, string> = {
    physician: "Physician",
    radiologist: "Radiologist",
    nuclear_med_physicist: "Nuclear medicine physicist",
    admin: "Administrator",
  };
  return labels[role] ?? role.replaceAll("_", " ");
}

function formatMessageTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatThreadScreen({ route, navigation }: Props) {
  const { channelId } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const markRead = useChatStore((state) => state.markRead);
  const setActiveChannel = useChatStore((state) => state.setActiveChannel);
  const [channel, setChannel] = useState<ChatChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [directTitle, setDirectTitle] = useState<string | null>(null);
  const loadingOlderRef = useRef(false);

  const hydrateMessages = useCallback(async (rows: MessageRow[]): Promise<ChatMessage[]> => {
    if (!profile || rows.length === 0) return [];
    const senderIds = [...new Set(rows.map((row) => row.sender_id))];
    const colleagueIds = senderIds.filter((senderId) => senderId !== profile.id);
    const { data: senders, error: senderError } = colleagueIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("institution_id", profile.institution_id)
          .in("id", colleagueIds)
      : { data: [], error: null };
    if (senderError) {
      throw new Error("Unable to read colleague names with the current profile access policy.");
    }
    if ((senders ?? []).length !== colleagueIds.length) {
      throw new Error("Unable to read colleague names with the current profile access policy.");
    }
    const sendersById = new Map<string, { name: string; role: string }>([
      [profile.id, { name: profile.full_name, role: profile.role }],
      ...(senders ?? []).map((sender) => [
        sender.id as string,
        { name: sender.full_name as string, role: sender.role as string },
      ] as const),
    ]);

    return rows.map((row) => {
      const sender = sendersById.get(row.sender_id);
      return {
        ...row,
        senderName: sender?.name ?? "Colleague",
        senderRole: sender ? formatRole(sender.role) : "",
      };
    });
  }, [profile]);

  const loadInitial = useCallback(async () => {
    if (!profile?.credential_verified || !profile.is_active) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: channelData, error: channelError } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("id", channelId)
        .single();
      if (channelError || !channelData) throw new Error("Unable to load this channel.");
      const loadedChannel = channelData as ChatChannel;
      setChannel(loadedChannel);

      if (loadedChannel.patient_id) {
        const { data: patient, error: patientError } = await supabase
          .from("patients")
          .select("full_name")
          .eq("id", loadedChannel.patient_id)
          .maybeSingle();
        if (patientError) throw new Error("Unable to load the patient record.");
        setPatientName(patient?.full_name as string | null ?? null);
      } else {
        setPatientName(null);
      }

      if (loadedChannel.kind === "direct") {
        const { data: members, error: membersError } = await supabase
          .from("chat_members")
          .select("user_id")
          .eq("channel_id", channelId);
        if (membersError) throw new Error("Unable to load direct-message members.");
        const colleagueIds = (members ?? [])
          .map((member) => member.user_id as string)
          .filter((userId) => userId !== profile.id);
        const { data: colleagues, error: colleaguesError } = colleagueIds.length
          ? await supabase
              .from("profiles")
              .select("full_name")
              .eq("institution_id", profile.institution_id)
              .in("id", colleagueIds)
          : { data: [], error: null };
        if (colleaguesError) {
          throw new Error("Unable to read colleague names with the current profile access policy.");
        }
        if ((colleagues ?? []).length !== colleagueIds.length) {
          throw new Error("Unable to read colleague names with the current profile access policy.");
        }
        setDirectTitle((colleagues ?? []).map((colleague) => colleague.full_name as string).join(", "));
      } else {
        setDirectTitle(null);
      }

      const { data: page, error: messageError } = await supabase
        .from("chat_messages")
        .select("id, channel_id, institution_id, sender_id, body, created_at")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (messageError) throw new Error("Unable to load messages.");
      const hydrated = await hydrateMessages((page ?? []) as MessageRow[]);
      setMessages((current) => {
        const merged = new Map(current.map((message) => [message.id, message]));
        for (const message of hydrated) merged.set(message.id, message);
        return [...merged.values()].sort((first, second) =>
          second.created_at.localeCompare(first.created_at)
        );
      });
      setHasMore(hydrated.length === PAGE_SIZE);
      await markRead(channelId, profile.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this conversation.");
    } finally {
      setLoading(false);
    }
  }, [channelId, hydrateMessages, markRead, profile]);

  useEffect(() => {
    setActiveChannel(channelId);
    void loadInitial();

    if (!profile?.credential_verified || !profile.is_active) {
      return () => setActiveChannel(null);
    }

    const subscription = supabase
      .channel(`chat-thread:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          void hydrateMessages([row])
            .then(([message]) => {
              if (!message) return;
              setMessages((current) => [
                message,
                ...current.filter((item) => item.id !== message.id),
              ]);
              void markRead(channelId, profile.id);
            })
            .catch(() => setError("A new message could not be displayed."));
        }
      )
      .subscribe();

    return () => {
      setActiveChannel(null);
      void supabase.removeChannel(subscription);
    };
  }, [channelId, hydrateMessages, loadInitial, markRead, profile, setActiveChannel]);

  const loadOlder = useCallback(async () => {
    if (loadingOlderRef.current || !hasMore || messages.length === 0) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const oldest = messages[messages.length - 1]?.created_at;
    try {
      if (!oldest) return;
      const { data, error: queryError } = await supabase
        .from("chat_messages")
        .select("id, channel_id, institution_id, sender_id, body, created_at")
        .eq("channel_id", channelId)
        .lt("created_at", oldest)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (queryError) throw new Error("Unable to load older messages.");
      const older = await hydrateMessages((data ?? []) as MessageRow[]);
      setMessages((current) => {
        const existingIds = new Set(current.map((item) => item.id));
        return [...current, ...older.filter((item) => !existingIds.has(item.id))];
      });
      setHasMore(older.length === PAGE_SIZE);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load older messages.");
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [channelId, hasMore, hydrateMessages, messages]);

  const retryMessage = useCallback(async (message: ChatMessage) => {
    if (!profile) return;
    setMessages((current) => current.map((item) =>
      item.id === message.id ? { ...item, delivery: "sending" } : item
    ));
    const { data, error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        channel_id: channelId,
        institution_id: profile.institution_id,
        sender_id: profile.id,
        body: message.body,
      })
      .select("id, channel_id, institution_id, sender_id, body, created_at")
      .single();
    if (insertError || !data) {
      setMessages((current) => current.map((item) =>
        item.id === message.id ? { ...item, delivery: "failed" } : item
      ));
      return;
    }
    const [saved] = await hydrateMessages([data as MessageRow]);
    setMessages((current) => [
      saved,
      ...current.filter((item) => item.id !== message.id && item.id !== saved.id),
    ]);
    await markRead(channelId, profile.id);
  }, [channelId, hydrateMessages, markRead, profile]);

  const sendMessage = useCallback(async () => {
    if (!profile || !draft.trim() || draft.length > 4000 || !channel) return;
    const body = draft.trim();
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      channel_id: channelId,
      institution_id: profile.institution_id,
      sender_id: profile.id,
      body,
      created_at: new Date().toISOString(),
      senderName: profile.full_name,
      senderRole: formatRole(profile.role),
      delivery: "sending",
    };
    setDraft("");
    setMessages((current) => [optimistic, ...current]);

    const { data, error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        channel_id: channel.id,
        institution_id: profile.institution_id,
        sender_id: profile.id,
        body,
      })
      .select("id, channel_id, institution_id, sender_id, body, created_at")
      .single();
    if (insertError || !data) {
      setMessages((current) => current.map((item) =>
        item.id === optimistic.id ? { ...item, delivery: "failed" } : item
      ));
      return;
    }

    const [saved] = await hydrateMessages([data as MessageRow]);
    setMessages((current) => [
      saved,
      ...current.filter((item) => item.id !== optimistic.id && item.id !== saved.id),
    ]);
    await markRead(channelId, profile.id);
  }, [channel, channelId, draft, hydrateMessages, markRead, profile]);

  const threadTitle = useMemo(() => {
    if (!channel) return "Chat";
    if (channel.kind === "patient") return patientName ?? "Patient thread";
    if (channel.kind === "direct") return directTitle || "Direct message";
    return channel.name ?? "Team discussion";
  }, [channel, directTitle, patientName]);

  useEffect(() => {
    navigation.setOptions({
      title: threadTitle,
      headerRight: () => (
        <View className="flex-row items-center gap-4">
          {channel?.kind === "patient" && channel.patient_id ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.getParent()?.navigate("Patients", {
                screen: "PatientDetail",
                params: { patientId: channel.patient_id },
              })}
            >
              <Text className="text-sm font-semibold text-clinical-primary">Patient</Text>
            </Pressable>
          ) : null}
          {channel?.created_by === profile?.id && profile?.credential_verified === true ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add colleague"
              onPress={() => navigation.navigate("ChatColleaguePicker", { channelId })}
            >
              <Ionicons name="person-add-outline" size={21} color="#1E3A5F" />
            </Pressable>
          ) : null}
        </View>
      ),
    });
  }, [channel, channelId, navigation, profile, threadTitle]);

  if (!profile?.credential_verified || !profile.is_active) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg px-8">
        <Text className="text-center text-base font-semibold text-clinical-primary">
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

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-clinical-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {error ? (
        <View className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <Text className="text-sm text-red-800">{error}</Text>
        </View>
      ) : null}
      <FlatList
        inverted
        data={messages}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          hasMore ? (
            <Pressable onPress={loadOlder} disabled={loadingOlder} className="items-center py-4">
              {loadingOlder ? <ActivityIndicator color="#1E3A5F" /> : <Text className="text-xs font-semibold text-clinical-primary">Load older messages</Text>}
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center px-8 py-12">
            <Text className="text-sm text-gray-500">No messages yet.</Text>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexGrow: 1 }}
        renderItem={({ item }) => {
          const ownMessage = item.sender_id === profile.id;
          return (
            <View className={`mb-3 max-w-[88%] rounded-lg border px-3 py-2 ${ownMessage ? "self-end border-clinical-primary bg-clinical-primary" : "self-start border-gray-200 bg-white"}`}>
              <Text className={`text-xs font-semibold ${ownMessage ? "text-white/80" : "text-clinical-primary"}`}>
                {item.senderName}{item.senderRole ? ` · ${item.senderRole}` : ""}
              </Text>
              <Text selectable className={`mt-1 text-sm ${ownMessage ? "text-white" : "text-gray-900"}`}>
                {item.body}
              </Text>
              <View className="mt-1 flex-row items-center justify-end gap-2">
                {item.delivery === "failed" ? (
                  <Pressable onPress={() => void retryMessage(item)} accessibilityRole="button">
                    <Text className="text-xs font-semibold text-red-600">Failed, tap to retry</Text>
                  </Pressable>
                ) : item.delivery === "sending" ? (
                  <Text className={`text-xs ${ownMessage ? "text-white/70" : "text-gray-400"}`}>Sending...</Text>
                ) : null}
                <Text className={`text-xs ${ownMessage ? "text-white/70" : "text-gray-400"}`}>
                  {formatMessageTime(item.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View className="border-t border-gray-200 bg-white px-3 py-2">
        <View className="flex-row items-end gap-2">
          <AppTextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={4000}
            textAlignVertical="top"
            placeholder="Write a message"
            className="max-h-28 min-h-11 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={!draft.trim() || draft.length > 4000}
            onPress={() => void sendMessage()}
            className={`h-11 w-11 items-center justify-center rounded-full ${draft.trim() ? "bg-clinical-primary" : "bg-gray-300"}`}
          >
            <Ionicons name="send" size={17} color="#FFFFFF" />
          </Pressable>
        </View>
        <Text className="mt-1 self-end text-xs text-gray-400">{draft.length}/4000</Text>
      </View>
    </KeyboardAvoidingView>
  );
}