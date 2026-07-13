import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MonitoringStackParamList } from "../../navigation/MonitoringStack";

type Props = NativeStackScreenProps<MonitoringStackParamList, "MonitoringDashboard">;

interface DashboardRow {
  id: string;
  patient_id: string;
  isotope: string;
  administered_date: string | null;
  patients: { full_name: string } | null;
  treatment_monitoring: { next_imaging_due_date: string | null }[] | null;
}

function daysElapsed(dateStr: string | null): string {
  if (!dateStr) return "—";
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  const days = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function MonitoringDashboardScreen({ navigation }: Props) {
  const [rows, setRows] = useState<DashboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRows = useCallback(async () => {
    const { data, error } = await supabase
      .from("treatment_logs")
      .select("id, patient_id, isotope, administered_date, patients(full_name), treatment_monitoring(next_imaging_due_date)")
      .order("administered_date", { ascending: false });

    if (!error && data) setRows(data as unknown as DashboardRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadRows);
    return unsubscribe;
  }, [navigation, loadRows]);

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
        data={rows}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Text className="text-gray-400 text-center">
              No treatments logged yet across any patient.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const nextImaging = item.treatment_monitoring?.[0]?.next_imaging_due_date;
          return (
            <Pressable
              onPress={() =>
                navigation.navigate("TreatmentMonitoringDetail", {
                  treatmentLogId: item.id,
                  patientId: item.patient_id,
                })
              }
              className="bg-clinical-card rounded-xl p-4 mb-3 border border-gray-100"
            >
              <View className="flex-row justify-between items-start">
                <Text className="text-base font-medium text-clinical-primary">
                  {item.patients?.full_name ?? "Unknown patient"}
                </Text>
                <Text className="text-xs text-gray-400">{item.isotope}</Text>
              </View>
              <Text className="text-xs text-gray-500 mt-1">
                Administered: {daysElapsed(item.administered_date)}
              </Text>
              <Text className="text-xs text-gray-500 mt-1">
                Next imaging due: {nextImaging ?? "Not set"}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}