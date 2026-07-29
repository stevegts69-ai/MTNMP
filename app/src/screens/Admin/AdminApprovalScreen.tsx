import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { logAudit } from "../../lib/audit";
import type { Profile } from "../../types";

export default function AdminApprovalScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [pending, setPending] = useState<Profile[]>([]);
  const [verified, setVerified] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const all = data as Profile[];
      setPending(all.filter((p) => !p.credential_verified));
      setVerified(all.filter((p) => p.credential_verified));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const handleVerify = (target: Profile) => {
    Alert.alert(
      "Verify Account",
      `Confirm that ${target.full_name} (${target.role}) has been verified through your institution's own credentialing process. This grants write access to clinical records.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Verify",
          onPress: async () => {
            setVerifyingId(target.id);
            const { error } = await supabase
              .from("profiles")
              .update({ credential_verified: true })
              .eq("id", target.id);

            setVerifyingId(null);

            if (error) {
              Alert.alert("Error", error.message);
              return;
            }

            if (profile) {
              await logAudit({
                userId: profile.id,
                institutionId: profile.institution_id,
                action: "update",
                tableName: "profiles",
                recordId: target.id,
              });
            }

            loadProfiles();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-clinical-bg px-4 pt-4">
      <FlatList
        data={pending}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Text className="text-sm font-medium text-gray-600 mb-2">
            Pending Approval ({pending.length})
          </Text>
        }
        ListEmptyComponent={
          <Text className="text-gray-400 text-sm mb-4">No accounts awaiting approval.</Text>
        }
        renderItem={({ item }) => (
          <View className="bg-clinical-card rounded-xl p-4 mb-3 border border-clinical-warn/40">
            <Text className="text-base font-medium text-clinical-primary">
              {item.full_name}
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              {item.role} {item.credential_number ? `· ${item.credential_number}` : ""}
            </Text>
            <Pressable
              onPress={() => handleVerify(item)}
              disabled={verifyingId === item.id}
              className="bg-clinical-primary rounded-lg py-2 items-center mt-3"
            >
              {verifyingId === item.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white text-sm font-medium">Verify</Text>
              )}
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <>
            <Text className="text-sm font-medium text-gray-600 mb-2 mt-4">
              Verified Team Members ({verified.length})
            </Text>
            {verified.map((v) => (
              <View
                key={v.id}
                className="bg-clinical-card rounded-xl p-4 mb-3 border border-gray-100"
              >
                <Text className="text-sm font-medium text-gray-800">{v.full_name}</Text>
                <Text className="text-xs text-gray-500 mt-1">{v.role}</Text>
              </View>
            ))}
            <View className="h-10" />
          </>
        }
      />
    </View>
  );
}