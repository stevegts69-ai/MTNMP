import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, Pressable } from "react-native";
import { supabase } from "../../lib/supabase";
import type { Patient } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "PatientDetail">;

export default function PatientDetailScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: fetchError } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setPatient(data as Patient);
      }
      setLoading(false);
    })();
  }, [patientId]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  if (error || !patient) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg px-6">
        <Text className="text-clinical-danger text-center">
          {error ?? "Patient not found."}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-5 pt-5">
      <Text className="text-xl font-semibold text-clinical-primary mb-1">
        {patient.full_name}
      </Text>
      <Text className="text-sm text-gray-500 mb-6">MRN: {patient.mrn}</Text>

      <InfoRow label="Date of Birth" value={patient.date_of_birth ?? "—"} />
      <InfoRow label="Sex" value={patient.sex ?? "—"} />
      <InfoRow label="Cancer Type" value={patient.cancer_type ?? "—"} />
      <InfoRow label="Cancer Stage" value={patient.cancer_stage ?? "—"} />
      <InfoRow label="Record Created" value={new Date(patient.created_at).toLocaleDateString()} />

      <Pressable
        onPress={() => navigation.navigate("PatientImaging", { patientId: patient.id })}
        className="mt-8 p-4 bg-clinical-card rounded-xl border border-gray-100"
      >
        <Text className="text-clinical-primary font-medium text-center">View Imaging</Text>
        <Text className="text-xs text-gray-400 text-center mt-1">
          Metabolic and treatment records will appear here as those modules are built (Days 4–6).
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-3 border-b border-gray-100">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text className="text-sm text-gray-800 font-medium">{value}</Text>
    </View>
  );
}