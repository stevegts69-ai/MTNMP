import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import type { TreatmentLog } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "PatientTreatment">;

export default function PatientTreatmentScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const [logs, setLogs] = useState<TreatmentLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("treatment_logs")
      .select("*")
      .eq("patient_id", patientId)
      .order("administered_date", { ascending: false });

    if (!error && data) setLogs(data as TreatmentLog[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadLogs);
    return unsubscribe;
  }, [navigation, loadLogs]);

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
        onPress={() => navigation.navigate("NewTreatmentLog", { patientId })}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-4"
      >
        <Text className="text-white font-medium">+ Log Treatment</Text>
      </Pressable>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Text className="text-gray-400 text-center">
              No treatment records logged yet for this patient.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("TreatmentLogDetail", { treatmentLogId: item.id })}
            className="bg-clinical-card rounded-xl p-4 mb-3 border border-gray-100"
          >
            <View className="flex-row justify-between items-start">
              <Text className="text-base font-medium text-clinical-primary">{item.isotope}</Text>
              {item.administered_date ? (
                <Text className="text-xs text-gray-400">{item.administered_date}</Text>
              ) : null}
            </View>
            {item.target_receptor_or_tissue ? (
              <Text className="text-xs text-gray-500 mt-1">
                Target: {item.target_receptor_or_tissue}
              </Text>
            ) : null}
            {item.dose_administered ? (
              <Text className="text-xs text-gray-500 mt-1">
                Dose: {item.dose_administered} {item.dose_unit}
              </Text>
            ) : null}
            {item.dosimetry_source ? (
              <Text className="text-xs text-gray-400 mt-1">Source: {item.dosimetry_source}</Text>
            ) : null}
            {item.notes ? (
              <Text className="text-xs text-gray-500 mt-2">{item.notes}</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}