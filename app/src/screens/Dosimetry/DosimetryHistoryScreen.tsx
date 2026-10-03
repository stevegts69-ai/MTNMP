import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";
import type { DosimetryRecord } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "DosimetryHistory">;

export default function DosimetryHistoryScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const [records, setRecords] = useState<DosimetryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setError(null);
    const { data, error: queryError } = await supabase
      .from("dosimetry_records")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      setRecords((data ?? []) as DosimetryRecord[]);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadRecords);
    return unsubscribe;
  }, [navigation, loadRecords]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-clinical-bg px-4 pt-4">
      <Pressable
        onPress={() => navigation.navigate("DosimetryForm", { patientId })}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-4"
      >
        <Text className="text-white font-medium">+ Record Dosimetry</Text>
      </Pressable>

      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={records.length === 0 ? { flexGrow: 1 } : undefined}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Text className="text-gray-400 text-center">
              No dosimetry records saved for this patient.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-clinical-card rounded-lg p-4 mb-3 border border-gray-100">
            <View className="flex-row justify-between items-start">
              <Text className="text-base font-medium text-clinical-primary">
                Cycle {item.cycle_number} · {item.isotope}
              </Text>
              <Text className="text-xs text-gray-400">
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
            <Text className="text-xs text-gray-500 mt-1">
              Calculation method: {item.calculation_method}
            </Text>
            {item.imaging_timepoints.length > 0 ? (
              <Text className="text-xs text-gray-500 mt-2">
                Imaging timepoints: {item.imaging_timepoints.length}
              </Text>
            ) : null}
            {item.organ_doses.length > 0 ? (
              <Text className="text-xs text-gray-500 mt-1">
                Organ doses: {item.organ_doses.map((dose) => `${dose.organ} ${dose.dose_gy} Gy`).join(", ")}
              </Text>
            ) : null}
            {item.tumor_doses.length > 0 ? (
              <Text className="text-xs text-gray-500 mt-1">
                Tumor doses: {item.tumor_doses
                  .map((dose) => `${dose.lesion_label} ${dose.dose_gy} Gy`)
                  .join(", ")}
              </Text>
            ) : null}
            {item.notes ? <Text className="text-xs text-gray-500 mt-2">{item.notes}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}