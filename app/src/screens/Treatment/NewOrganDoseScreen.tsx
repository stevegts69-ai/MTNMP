import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import AppTextInput from "../../components/AppTextInput";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { logAudit } from "../../lib/audit";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "NewOrganDose">;

const COMMON_ORGANS = ["Liver", "Kidney", "Bone Marrow", "Spleen", "Other"];

export default function NewOrganDoseScreen({ route, navigation }: Props) {
  const { treatmentLogId } = route.params;
  const profile = useAuthStore((s) => s.profile);

  const [organ, setOrgan] = useState("Liver");
  const [customOrgan, setCustomOrgan] = useState("");
  const [doseValue, setDoseValue] = useState("");
  const [doseLimit, setDoseLimit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedOrgan = organ === "Other" ? customOrgan.trim() : organ;

  const validate = (): string | null => {
    if (!resolvedOrgan) return "Enter an organ name.";
    if (!doseValue.trim()) return "Enter a dose value.";
    const val = parseFloat(doseValue);
    if (Number.isNaN(val) || val < 0) return "Dose value must be a non-negative number.";
    if (doseLimit.trim()) {
      const limit = parseFloat(doseLimit);
      if (Number.isNaN(limit) || limit < 0) return "Dose limit reference must be a non-negative number.";
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
    if (!profile) return;

    setSubmitting(true);
    const doseNum = parseFloat(doseValue);
    const limitNum = doseLimit.trim() ? parseFloat(doseLimit) : null;

    const { data: inserted, error: insertError } = await supabase
      .from("organ_dose_logs")
      .insert({
        treatment_log_id: treatmentLogId,
        organ: resolvedOrgan,
        dose_value: doseNum,
        dose_limit_reference: limitNum,
      })
      .select()
      .single();

    if (insertError) {
      setSubmitting(false);
      setError(insertError.message);
      return;
    }

    await logAudit({
      userId: profile.id,
      institutionId: profile.institution_id,
      action: "create",
      tableName: "organ_dose_logs",
      recordId: inserted?.id,
    });

    // Threshold comparison only — this is a flag for the physician to review,
    // not an automated clinical judgment or recommendation.
    if (limitNum != null && doseNum > limitNum) {
      const { data: alert } = await supabase
        .from("safety_alerts")
        .insert({
          treatment_log_id: treatmentLogId,
          alert_type: "organ_dose_threshold",
          threshold_value: limitNum,
          entered_value: doseNum,
        })
        .select()
        .single();

      await logAudit({
        userId: profile.id,
        institutionId: profile.institution_id,
        action: "create",
        tableName: "safety_alerts",
        recordId: alert?.id,
      });
    }

    setSubmitting(false);
    Alert.alert("Reading logged", "The organ dose reading has been saved.");
    navigation.goBack();
  };

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-5 pt-4" keyboardShouldPersistTaps="handled">
      <Text className="text-lg font-semibold text-clinical-primary mb-4">
        Log Organ Dose Reading
      </Text>

      <Text className="text-xs font-medium text-gray-600 mb-1">Organ</Text>
      <View className="flex-row flex-wrap mb-2">
        {COMMON_ORGANS.map((o) => (
          <Pressable
            key={o}
            onPress={() => setOrgan(o)}
            className={`px-4 py-2 rounded-lg mr-2 mb-2 border ${
              organ === o
                ? "bg-clinical-primary border-clinical-primary"
                : "bg-clinical-card border-gray-300"
            }`}
          >
            <Text className={organ === o ? "text-white" : "text-gray-700"}>{o}</Text>
          </Pressable>
        ))}
      </View>
      {organ === "Other" ? (
        <AppTextInput
          value={customOrgan}
          onChangeText={setCustomOrgan}
          placeholder="Specify organ"
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
        />
      ) : (
        <View className="mb-2" />
      )}

      <Text className="text-xs font-medium text-gray-600 mb-1">Dose Value</Text>
      <AppTextInput
        value={doseValue}
        onChangeText={setDoseValue}
        keyboardType="decimal-pad"
        placeholder="e.g. 18.5"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
      />

      <Text className="text-xs font-medium text-gray-600 mb-1">Dose Limit Reference (optional)</Text>
      <AppTextInput
        value={doseLimit}
        onChangeText={setDoseLimit}
        keyboardType="decimal-pad"
        placeholder="e.g. 23"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-1 bg-clinical-card"
      />
      <Text className="text-xs text-gray-400 mb-4">
        If a limit reference is provided and the dose value exceeds it, a safety flag
        will be raised for physician review — this is a threshold comparison only,
        not an automated clinical judgment.
      </Text>

      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-10"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-medium">Save Reading</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}