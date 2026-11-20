import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import AppTextInput from "../../components/AppTextInput";
import {
  addChatMember,
  createDirectChannel,
  findDirectChannelWithMember,
  type ChatChannel,
  type ChatProfile,
  type ChatStackParamList,
} from "../../lib/chat";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { useChatStore } from "../../store/chatStore";

type Props = NativeStackScreenProps<ChatStackParamList, "ChatColleaguePicker">;

interface Colleague {
  id: string;
  full_name: string;
  role: string;
}

function displayRole(role: string): string {
  const labels: Record<string, string> = {
    physician: "Physician",
    radiologist: "Radiologist",
    nuclear_med_physicist: "Nuclear medicine physicist",
    admin: "Administrator",
  };
  return labels[role] ?? role.replaceAll("_", " ");
}

export default function ChatColleaguePickerScreen({ route, navigation }: Props) {
  const { channelId } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const startUnreadTracking = useChatStore((state) => state.startUnreadTracking);
  const [query, setQuery] = useState("");
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!profile?.credential_verified || !profile.is_active) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError(null);
    let request = supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("institution_id", profile.institution_id)
      .eq("credential_verified", true)
      .eq("is_active", true)
      .neq("id", profile.id)
      .order("full_name", { ascending: true })
      .limit(50);
    const trimmedQuery = query.trim();
    if (trimmedQuery) request = request.ilike("full_name", `%${trimmedQuery}%`);

    void request.then(({ data, error: queryError }) => {
      if (cancelled) return;
      if (queryError) {
        setError("Colleague names are unavailable under the current profile access policy.");
        setColleagues([]);
      } else {
        setColleagues((data ?? []) as Colleague[]);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [profile, query]);

  const selectColleague = async (colleague: Colleague) => {
    if (!profile) return;
    setBusyId(colleague.id);
    setError(null);
    try {
      let channel: ChatChannel;
      if (channelId) {
        const { data, error: channelError } = await supabase
          .from("chat_channels")
          .select("*")
          .eq("id", channelId)
          .single();
        if (channelError || !data) throw new Error("Unable to load this channel.");
        channel = data as ChatChannel;
        await addChatMember(channel, colleague.id, profile as ChatProfile);
        await startUnreadTracking(profile as ChatProfile);
        navigation.goBack();
      } else {
        channel = await findDirectChannelWithMember(profile as ChatProfile, colleague.id)
          ?? await createDirectChannel(profile as ChatProfile, colleague.id);
        await startUnreadTracking(profile as ChatProfile);
        navigation.replace("ChatThread", { channelId: channel.id });
      }
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "Unable to open this conversation.");
    } finally {
      setBusyId(null);
    }
  };

  if (!profile?.credential_verified || !profile.is_active) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg px-8">
        <Text className="text-center text-base font-semibold text-clinical-primary">
          Chat is available after credential verification.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-clinical-bg px-4 pt-4">
      <AppTextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search colleagues by name"
        autoCapitalize="words"
        autoCorrect={false}
        className="mb-3 rounded-lg border border-gray-300 bg-white px-4 py-3"
      />
      {error ? (
        <View className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <Text className="text-sm text-red-800">{error}</Text>
        </View>
      ) : null}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1E3A5F" />
        </View>
      ) : (
        <FlatList
          data={colleagues}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text className="mt-8 text-center text-sm text-gray-500">
              {error ? "" : "No colleagues found."}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              disabled={busyId !== null}
              onPress={() => void selectColleague(item)}
              className="mb-2 min-h-16 flex-row items-center rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-clinical-primary/10">
                {busyId === item.id ? (
                  <ActivityIndicator size="small" color="#1E3A5F" />
                ) : (
                  <Ionicons name="person-outline" size={19} color="#1E3A5F" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">{item.full_name}</Text>
                <Text className="mt-1 text-xs text-gray-500">{displayRole(item.role)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color="#9CA3AF" />
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}