import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { logAudit } from "../../lib/audit";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "NewPatient">;

const SEX_OPTIONS = ["Male", "Female", "Other"] as const;

export default function NewPatientScreen({ navigation }: Props) {
  const profile = useAuthStore((s) => s.profile);

  const [mrn, setMrn] = useState("");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(""); // YYYY-MM-DD
  const [sex, setSex] = useState<(typeof SEX_OPTIONS)[number] | "">("");
  const [cancerType, setCancerType] = useState("");
  const [cancerStage, setCancerStage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!mrn.trim()) return "MRN is required.";
    if (!fullName.trim()) return "Patient name is required.";
    if (dateOfBirth.trim()) {
      const dobPattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobPattern.test(dateOfBirth.trim())) {
        return "Date of birth must be in YYYY-MM-DD format.";
      }
      const parsed = new Date(dateOfBirth.trim());
      if (Number.isNaN(parsed.getTime()) || parsed > new Date()) {
        return "Date of birth is invalid or in the future.";
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!profile?.institution_id) {
      setError("No institution found for your account. Contact your admin.");
      return;
    }

    setSubmitting(true);
    const { data: inserted, error: insertError } = await supabase
      .from("patients")
      .insert({
        institution_id: profile.institution_id,
        mrn: mrn.trim(),
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth.trim() || null,
        sex: sex || null,
        cancer_type: cancerType.trim() || null,
        cancer_stage: cancerStage.trim() || null,
        created_by: profile.id,
      })
      .select()
      .single();
    setSubmitting(false);

    if (insertError) {
      // Postgres unique_violation on (institution_id, mrn)
      if (insertError.code === "23505") {
        setError("A patient with this MRN already exists at your institution.");
      } else {
        setError(insertError.message);
      }
      return;
    }

    await logAudit({
      userId: profile.id,
      institutionId: profile.institution_id,
      action: "create",
      tableName: "patients",
      recordId: inserted?.id,
    });

    Alert.alert("Patient created", `${fullName.trim()} has been added.`);
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-clinical-bg"
    >
      <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
        <Text className="text-lg font-semibold text-clinical-primary mb-4">
          New Patient
        </Text>

        <Field label="MRN *" value={mrn} onChangeText={setMrn} placeholder="e.g. MRN-00123" />
        <Field label="Full Name *" value={fullName} onChangeText={setFullName} placeholder="Patient full name" />
        <Field
          label="Date of Birth"
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="YYYY-MM-DD"
        />

        <Text className="text-xs font-medium text-gray-600 mb-1">Sex</Text>
        <View className="flex-row mb-4">
          {SEX_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => setSex(opt)}
              className={`px-4 py-2 rounded-lg mr-2 border ${
                sex === opt
                  ? "bg-clinical-primary border-clinical-primary"
                  : "bg-clinical-card border-gray-300"
              }`}
            >
              <Text className={sex === opt ? "text-white" : "text-gray-700"}>{opt}</Text>
            </Pressable>
          ))}
        </View>

        <Field label="Cancer Type" value={cancerType} onChangeText={setCancerType} placeholder="e.g. Neuroendocrine tumor" />
        <Field label="Cancer Stage" value={cancerStage} onChangeText={setCancerStage} placeholder="e.g. Stage II" />

        {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="bg-clinical-primary rounded-lg py-3 items-center mt-2 mb-10"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-medium">Save Patient</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-medium text-gray-600 mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        className="border border-gray-300 rounded-lg px-4 py-3 bg-clinical-card"
      />
    </View>
  );
}