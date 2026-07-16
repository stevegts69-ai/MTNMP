import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "../lib/supabase";

export type QueuedTable = "metabolic_logs" | "treatment_logs";

export interface QueuedWrite {
  localId: string;
  table: QueuedTable;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface OfflineQueueState {
  queue: QueuedWrite[];
  syncing: boolean;
  enqueue: (table: QueuedTable, payload: Record<string, unknown>) => void;
  syncQueue: () => Promise<{ succeeded: number; failed: number }>;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      syncing: false,

      enqueue: (table, payload) => {
        const item: QueuedWrite = {
          localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          table,
          payload,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ queue: [...state.queue, item] }));
      },

      syncQueue: async () => {
        const { queue, syncing } = get();
        if (syncing || queue.length === 0) return { succeeded: 0, failed: 0 };

        set({ syncing: true });
        let succeeded = 0;
        let failed = 0;
        const remaining: QueuedWrite[] = [];

        for (const item of queue) {
          const { error } = await supabase.from(item.table).insert(item.payload);
          if (error) {
            failed += 1;
            remaining.push(item); // keep it queued, try again next sync
          } else {
            succeeded += 1;
          }
        }

        set({ queue: remaining, syncing: false });
        return { succeeded, failed };
      },
    }),
    {
      name: "offline-write-queue",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Auto-sync whenever connectivity is restored — this is what makes the
// queue actually useful rather than requiring the doctor to remember to
// tap "Sync Now" every time.
NetInfo.addEventListener((state) => {
  if (state.isConnected && state.isInternetReachable !== false) {
    useOfflineQueueStore.getState().syncQueue();
  }
});