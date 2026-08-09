import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { logAudit } from "../../lib/audit";
import type { Profile } from "../../types";

export default function AdminApprovalScreen() {
  const profile = useAuthStore((s) => s.profile);
  const [pending, setPending] = useState<Profile[]>([]);
  const [active, setActive] = useState<Profile[]>([]);
  const [inactive, setInactive] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const all = data as Profile[];
      setPending(all.filter((p) => !p.credential_verified && p.is_active));
      setActive(all.filter((p) => p.credential_verified && p.is_active));
      setInactive(all.filter((p) => !p.is_active));
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
            setBusyId(target.id);
            const { error } = await supabase
              .from("profiles")
              .update({ credential_verified: true })
              .eq("id", target.id);
            setBusyId(null);

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

  const handleSetActive = (target: Profile, nextActive: boolean) => {
    // Safety guard: never let an admin deactivate their own account —
    // that could lock an institution out with no one left to undo it.
    if (target.id === profile?.id) {
      Alert.alert(
        "Not allowed",
        "You can't deactivate your own account. Have another admin do this, or contact platform support."
      );
      return;
    }

    Alert.alert(
      nextActive ? "Reactivate Account" : "Deactivate Account",
      nextActive
        ? `Restore ${target.full_name}'s access to patient records?`
        : `${target.full_name} will immediately lose all access to patient records — this is for staff who have left the institution. This can be undone later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: nextActive ? "Reactivate" : "Deactivate",
          style: nextActive ? "default" : "destructive",
          onPress: async () => {
            setBusyId(target.id);
            const { error } = await supabase
              .from("profiles")
              .update({ is_active: nextActive })
              .eq("id", target.id);
            setBusyId(null);

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
              disabled={busyId === item.id}
              className="bg-clinical-primary rounded-lg py-2 items-center mt-3"
            >
              {busyId === item.id ? (
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
              Active Team Members ({active.length})
            </Text>
            {active.map((v) => (
              <View
                key={v.id}
                className="bg-clinical-card rounded-xl p-4 mb-3 border border-gray-100"
              >
                <Text className="text-sm font-medium text-gray-800">{v.full_name}</Text>
                <Text className="text-xs text-gray-500 mt-1">{v.role}</Text>
                {v.id === profile?.id ? (
                  <Text className="text-xs text-gray-400 mt-2">This is you</Text>
                ) : (
                  <Pressable
                    onPress={() => handleSetActive(v, false)}
                    disabled={busyId === v.id}
                    className="border border-clinical-danger rounded-lg py-2 items-center mt-3"
                  >
                    {busyId === v.id ? (
                      <ActivityIndicator color="#B3261E" size="small" />
                    ) : (
                      <Text className="text-clinical-danger text-sm font-medium">Deactivate</Text>
                    )}
                  </Pressable>
                )}
              </View>
            ))}

            {inactive.length > 0 ? (
              <>
                <Text className="text-sm font-medium text-gray-600 mb-2 mt-6">
                  Deactivated ({inactive.length})
                </Text>
                {inactive.map((v) => (
                  <View
                    key={v.id}
                    className="bg-gray-100 rounded-xl p-4 mb-3 border border-gray-200"
                  >
                    <Text className="text-sm font-medium text-gray-500">{v.full_name}</Text>
                    <Text className="text-xs text-gray-400 mt-1">{v.role}</Text>
                    <Pressable
                      onPress={() => handleSetActive(v, true)}
                      disabled={busyId === v.id}
                      className="border border-clinical-primary rounded-lg py-2 items-center mt-3"
                    >
                      {busyId === v.id ? (
                        <ActivityIndicator color="#1E3A5F" size="small" />
                      ) : (
                        <Text className="text-clinical-primary text-sm font-medium">
                          Reactivate
                        </Text>
                      )}
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}
            <View className="h-10" />
          </>
        }
      />
    </View>
  );
}