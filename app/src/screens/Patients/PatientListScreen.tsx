import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, RefreshControl } from "react-native";
import { supabase } from "../../lib/supabase";
import type { Patient } from "../../types";

export default function PatientListScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPatients = useCallback(async () => {
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setPatients(data as Patient[]);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPatients();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <Text className="text-gray-400">Loading patients…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-clinical-bg px-4 pt-4">
      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Text className="text-gray-400 text-center">
              No patients yet. Tap "+ New Patient" to create the first record.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable className="bg-clinical-card rounded-xl p-4 mb-3 border border-gray-100">
            <Text className="text-base font-medium text-clinical-primary">
              {item.full_name}
            </Text>
            <Text className="text-xs text-gray-500 mt-1">
              MRN: {item.mrn} {item.cancer_type ? `· ${item.cancer_type}` : ""}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}
