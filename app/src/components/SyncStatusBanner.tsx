import React from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { useOfflineQueueStore } from "../store/offlineQueueStore";

export default function SyncStatusBanner() {
  const queue = useOfflineQueueStore((s) => s.queue);
  const syncing = useOfflineQueueStore((s) => s.syncing);
  const syncQueue = useOfflineQueueStore((s) => s.syncQueue);

  if (queue.length === 0 && !syncing) return null;

  return (
    <View className="bg-clinical-warn px-4 py-2 flex-row items-center justify-between">
      <Text className="text-xs text-white flex-1 mr-2">
        {syncing
          ? "Syncing pending records…"
          : `${queue.length} record${queue.length === 1 ? "" : "s"} not yet synced`}
      </Text>
      {syncing ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Pressable onPress={() => syncQueue()}>
          <Text className="text-white text-xs font-semibold">Sync Now</Text>
        </Pressable>
      )}
    </View>
  );
}