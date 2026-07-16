import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { logAudit } from "../../lib/audit";
import { useOfflineQueueStore } from "../../store/offlineQueueStore";
import NetInfo from "@react-native-community/netinfo";
import type { IsotopeType, DoseUnit } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "NewTreatmentLog">;

const ISOTOPES: IsotopeType[] = ["Lu177", "Y90", "I131", "Ra223", "other"];
const DOSE_UNITS: DoseUnit[] = ["mCi", "GBq"];

export default function NewTreatmentLogScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((s) => s.profile);
  const enqueue = useOfflineQueueStore((s) => s.enqueue);

  const [isotope, setIsotope] = useState<IsotopeType>("Lu177");
  const [targetTissue, setTargetTissue] = useState("");
  const [doseAdministered, setDoseAdministered] = useState("");
  const [doseUnit, setDoseUnit] = useState<DoseUnit>("mCi");
  const [dosimetrySource, setDosimetrySource] = useState("");
  const [administeredDate, setAdministeredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    const dose = doseAdministered.trim();
    if (dose) {
      const doseNum = parseFloat(dose);
      if (Number.isNaN(doseNum) || doseNum <= 0) {
        return "Dose administered must be a positive number.";
      }
      // Core PRD rule: a dose value is never accepted without attribution to
      // where it came from. This app logs clinical decisions, it doesn't make them.
      if (!dosimetrySource.trim()) {
        return "A dosimetry source reference is required whenever a dose value is entered.";
      }
    }
    if (administeredDate.trim()) {
      const pattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!pattern.test(administeredDate.trim())) {
        return "Administered date must be in YYYY-MM-DD format.";
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
    if (!profile?.institution_id) return;

    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected && netState.isInternetReachable !== false;

    const payload = {
      patient_id: patientId,
      institution_id: profile.institution_id,
      isotope,
      target_receptor_or_tissue: targetTissue.trim() || null,
      dose_administered: doseAdministered.trim() ? parseFloat(doseAdministered) : null,
      dose_unit: doseAdministered.trim() ? doseUnit : null,
      dosimetry_source: dosimetrySource.trim() || null,
      administered_date: administeredDate.trim() || null,
      administered_by: profile.id,
      notes: notes.trim() || null,
    };

    if (!isOnline) {
      enqueue("treatment_logs", payload);
      Alert.alert(
        "Saved offline",
        "This treatment record will sync automatically once you're back online."
      );
      navigation.goBack();
      return;
    }

    setSubmitting(true);
    const { data: inserted, error: insertError } = await supabase
      .from("treatment_logs")
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
      tableName: "treatment_logs",
      recordId: inserted?.id,
    });

    Alert.alert("Treatment logged", "The treatment record has been saved.");
    navigation.goBack();
  };

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-5 pt-4" keyboardShouldPersistTaps="handled">
      <Text className="text-lg font-semibold text-clinical-primary mb-4">Log Treatment</Text>

      <Text className="text-xs font-medium text-gray-600 mb-1">Isotope</Text>
      <View className="flex-row flex-wrap mb-4">
        {ISOTOPES.map((iso) => (
          <Pressable
            key={iso}
            onPress={() => setIsotope(iso)}
            className={`px-4 py-2 rounded-lg mr-2 mb-2 border ${
              isotope === iso
                ? "bg-clinical-primary border-clinical-primary"
                : "bg-clinical-card border-gray-300"
            }`}
          >
            <Text className={isotope === iso ? "text-white" : "text-gray-700"}>{iso}</Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-xs font-medium text-gray-600 mb-1">Target Receptor / Tissue</Text>
      <TextInput
        value={targetTissue}
        onChangeText={setTargetTissue}
        placeholder="e.g. Somatostatin receptor, thyroid"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
      />

      <Text className="text-xs font-medium text-gray-600 mb-1">Dose Administered</Text>
      <View className="flex-row mb-1">
        <TextInput
          value={doseAdministered}
          onChangeText={setDoseAdministered}
          keyboardType="decimal-pad"
          placeholder="e.g. 100"
          className="border border-gray-300 rounded-lg px-4 py-3 bg-clinical-card flex-1 mr-2"
        />
        <View className="flex-row">
          {DOSE_UNITS.map((unit) => (
            <Pressable
              key={unit}
              onPress={() => setDoseUnit(unit)}
              className={`px-4 py-3 rounded-lg ml-1 border ${
                doseUnit === unit
                  ? "bg-clinical-primary border-clinical-primary"
                  : "bg-clinical-card border-gray-300"
              }`}
            >
              <Text className={doseUnit === unit ? "text-white" : "text-gray-700"}>{unit}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Text className="text-xs text-gray-400 mb-4">
        This app does not calculate dose — enter the value determined through your
        institution's own dosimetry process.
      </Text>

      <Text className="text-xs font-medium text-gray-600 mb-1">
        Dosimetry Source {doseAdministered.trim() ? "*" : ""}
      </Text>
      <TextInput
        value={dosimetrySource}
        onChangeText={setDosimetrySource}
        placeholder="e.g. Dr. Njoroge, Nuclear Medicine Physics, ref #2026-014"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
      />

      <Text className="text-xs font-medium text-gray-600 mb-1">Administered Date</Text>
      <TextInput
        value={administeredDate}
        onChangeText={setAdministeredDate}
        placeholder="YYYY-MM-DD"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
      />

      <Text className="text-xs font-medium text-gray-600 mb-1">Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        multiline
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card h-20"
      />

      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-10"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-medium">Save Treatment Log</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}