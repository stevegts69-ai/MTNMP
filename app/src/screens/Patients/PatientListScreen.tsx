import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, TextInput } from "react-native";
import { supabase } from "../../lib/supabase";
import type { Patient } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "PatientList">;

export default function PatientListScreen({ navigation }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

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
    const unsubscribe = navigation.addListener("focus", loadPatients);
    return unsubscribe;
  }, [navigation, loadPatients]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPatients();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        (p.cancer_type ?? "").toLowerCase().includes(q)
    );
  }, [patients, query]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <Text className="text-gray-400">Loading patients…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-clinical-bg px-4 pt-4">
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name, MRN, or cancer type"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-3 bg-clinical-card"
      />

      <Pressable
        onPress={() => navigation.navigate("NewPatient")}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-4"
      >
        <Text className="text-white font-medium">+ New Patient</Text>
      </Pressable>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Text className="text-gray-400 text-center">
              {patients.length === 0
                ? 'No patients yet. Tap "+ New Patient" to create the first record.'
                : "No patients match your search."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("PatientDetail", { patientId: item.id })}
            className="bg-clinical-card rounded-xl p-4 mb-3 border border-gray-100"
          >
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