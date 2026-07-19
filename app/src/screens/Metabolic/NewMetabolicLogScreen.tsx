import React, { useMemo, useState } from "react";
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
import { useOfflineQueueStore } from "../../store/offlineQueueStore";
import NetInfo from "@react-native-community/netinfo";
import { computeKetosisZone, ZONE_COLORS, ZONE_LABELS } from "../../lib/ketosis";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "NewMetabolicLog">;

export default function NewMetabolicLogScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((s) => s.profile);
  const enqueue = useOfflineQueueStore((s) => s.enqueue);

  const [glucose, setGlucose] = useState("");
  const [ketones, setKetones] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const glucoseNum = glucose.trim() ? parseFloat(glucose) : null;
  const ketonesNum = ketones.trim() ? parseFloat(ketones) : null;

  const previewZone = useMemo(
    () => computeKetosisZone(glucoseNum, ketonesNum),
    [glucoseNum, ketonesNum]
  );

  const validate = (): string | null => {
    if (glucose.trim() && (Number.isNaN(glucoseNum) || glucoseNum! <= 0 || glucoseNum! >= 55)) {
      return "Glucose must be a number between 0 and 55 mmol/L.";
    }
    if (ketones.trim() && (Number.isNaN(ketonesNum) || ketonesNum! < 0 || ketonesNum! >= 10)) {
      return "Ketones must be a number between 0 and 10 mmol/L.";
    }
    if (!glucose.trim() && !ketones.trim()) {
      return "Enter at least one reading.";
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
    if (!profile?.institution_id) return;

    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected && netState.isInternetReachable !== false;

    const payload = {
      patient_id: patientId,
      institution_id: profile.institution_id,
      glucose_mmol_l: glucoseNum,
      ketones_mmol_l: ketonesNum,
      ketosis_zone: previewZone,
      logged_by: profile.id,
    };

    if (!isOnline) {
      enqueue("metabolic_logs", payload);
      Alert.alert(
        "Saved offline",
        "This reading will sync automatically once you're back online."
      );
      navigation.goBack();
      return;
    }

    setSubmitting(true);
    const { data: inserted, error: insertError } = await supabase
      .from("metabolic_logs")
      .insert(payload)
      .select()
      .single();
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    await logAudit({
      userId: profile.id,
      institutionId: profile.institution_id,
      action: "create",
      tableName: "metabolic_logs",
      recordId: inserted?.id,
    });

    Alert.alert("Reading logged", "The metabolic reading has been saved.");
    navigation.goBack();
  };

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-5 pt-4" keyboardShouldPersistTaps="handled">
      <Text className="text-lg font-semibold text-clinical-primary mb-4">
        Log Metabolic Reading
      </Text>

      <Text className="text-xs font-medium text-gray-600 mb-1">Glucose (mmol/L)</Text>
      <AppTextInput
        value={glucose}
        onChangeText={setGlucose}
        keyboardType="decimal-pad"
        placeholder="e.g. 4.8"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
      />

      <Text className="text-xs font-medium text-gray-600 mb-1">Ketones (mmol/L)</Text>
      <AppTextInput
        value={ketones}
        onChangeText={setKetones}
        keyboardType="decimal-pad"
        placeholder="e.g. 1.2"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
      />

      {previewZone ? (
        <View
          className="rounded-lg py-3 items-center mb-4"
          style={{ backgroundColor: ZONE_COLORS[previewZone] + "20" }}
        >
          <Text style={{ color: ZONE_COLORS[previewZone] }} className="font-medium">
            {ZONE_LABELS[previewZone]}
          </Text>
          <Text className="text-xs text-gray-500 mt-1 px-4 text-center">
            Descriptive indicator only — not a clinical assessment.
          </Text>
        </View>
      ) : null}

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