import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import AppTextInput from "../../components/AppTextInput";
import { logAudit } from "../../lib/audit";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { ExposureLog, IsotopeType, TreatmentLog } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "ExposureLog">;

interface ExposureHistoryRow extends ExposureLog {
  treatment_logs: {
    isotope: IsotopeType;
    cycle_number: number | null;
    administered_date: string | null;
  } | null;
}

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatTreatment(treatment: TreatmentLog): string {
  const cycle = treatment.cycle_number ? `Cycle ${treatment.cycle_number}` : "Cycle not recorded";
  const date = treatment.administered_date ?? "date not recorded";
  return `${treatment.isotope} · ${cycle} · ${date}`;
}

export default function ExposureLogScreen({ route }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const [treatments, setTreatments] = useState<TreatmentLog[]>([]);
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ExposureHistoryRow[]>([]);
  const [logDate, setLogDate] = useState(todayIsoDate);
  const [precautionNotes, setPrecautionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTreatments = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("treatment_logs")
      .select("*")
      .eq("patient_id", patientId)
      .order("administered_date", { ascending: false });
    if (queryError) {
      setError(queryError.message);
      return;
    }
    const records = (data ?? []) as TreatmentLog[];
    setTreatments(records);
    setSelectedTreatmentId((current) => current ?? records[0]?.id ?? null);
  }, [patientId]);

  const loadHistory = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("exposure_logs")
      .select("*, treatment_logs(isotope, cycle_number, administered_date)")
      .eq("patient_id", patientId)
      .order("log_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setLogs((data ?? []) as unknown as ExposureHistoryRow[]);
  }, [patientId]);

  useEffect(() => {
    (async () => {
      setError(null);
      await Promise.all([loadTreatments(), loadHistory()]);
      setLoading(false);
    })();
  }, [loadHistory, loadTreatments]);

  const handleSave = async () => {
    setError(null);
    if (!profile?.institution_id) {
      setError("Your institution profile is unavailable. Sign in again and retry.");
      return;
    }
    if (!selectedTreatmentId) {
      setError("Select the treatment record this patient-reported log relates to.");
      return;
    }
    const parsedDate = new Date(`${logDate.trim()}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(logDate.trim()) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== logDate.trim()) {
      setError("Enter the log date in YYYY-MM-DD format.");
      return;
    }
    if (!precautionNotes.trim()) {
      setError("Enter the precaution details reported by the patient.");
      return;
    }

    setSaving(true);
    const { data: inserted, error: insertError } = await supabase
      .from("exposure_logs")
      .insert({
        patient_id: patientId,
        treatment_log_id: selectedTreatmentId,
        institution_id: profile.institution_id,
        log_date: logDate.trim(),
        precaution_notes: precautionNotes.trim(),
        entered_by: profile.id,
      })
      .select("id")
      .single();
    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    await logAudit({
      userId: profile.id,
      institutionId: profile.institution_id,
      action: "create",
      tableName: "exposure_logs",
      recordId: inserted.id,
    });
    setPrecautionNotes("");
    await loadHistory();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-5 pt-4" keyboardShouldPersistTaps="handled">
      <Text className="text-lg font-semibold text-clinical-primary mb-1">Patient-Reported Exposure Log</Text>
      <Text className="text-xs text-gray-500 mb-4">
        Physician-transcribed travel/contact precaution notes only. This is not GPS, location tracking, or automated monitoring.
      </Text>

      <Text className="text-xs font-medium text-gray-600 mb-2">Related treatment record</Text>
      {treatments.length === 0 ? (
        <Text className="text-sm text-gray-500 mb-4">
          Record a treatment before adding an exposure log.
        </Text>
      ) : (
        <View className="mb-3">
          {treatments.map((treatment) => (
            <Pressable
              key={treatment.id}
              onPress={() => setSelectedTreatmentId(treatment.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: treatment.id === selectedTreatmentId }}
              className={`flex-row items-center rounded-lg border p-3 mb-2 ${treatment.id === selectedTreatmentId ? "border-clinical-primary bg-blue-50" : "border-gray-200 bg-clinical-card"}`}
            >
              <View className={`w-4 h-4 rounded-full border mr-3 items-center justify-center ${treatment.id === selectedTreatmentId ? "border-clinical-primary" : "border-gray-400"}`}>
                {treatment.id === selectedTreatmentId ? <View className="w-2 h-2 rounded-full bg-clinical-primary" /> : null}
              </View>
              <Text className="text-xs text-gray-700 flex-1">{formatTreatment(treatment)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text className="text-xs font-medium text-gray-600 mb-1">Log Date</Text>
      <AppTextInput
        value={logDate}
        onChangeText={setLogDate}
        placeholder="YYYY-MM-DD"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
      />

      <Text className="text-xs font-medium text-gray-600 mb-1">Patient-reported precaution notes</Text>
      <AppTextInput
        value={precautionNotes}
        onChangeText={setPrecautionNotes}
        placeholder="Transcribe the travel or contact precautions reported by the patient"
        multiline
        textAlignVertical="top"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card min-h-28"
      />

      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}
      <Pressable
        onPress={handleSave}
        disabled={saving || treatments.length === 0}
        className={`rounded-lg py-3 items-center mb-6 ${treatments.length ? "bg-clinical-primary" : "bg-gray-400"}`}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium">Save Exposure Log</Text>}
      </Pressable>

      <Text className="text-base font-semibold text-clinical-primary mb-3">History</Text>
      {logs.length === 0 ? (
        <Text className="text-sm text-gray-400 text-center py-6">No exposure logs recorded.</Text>
      ) : (
        logs.map((entry) => (
          <View key={entry.id} className="bg-clinical-card border border-gray-100 rounded-lg p-4 mb-3">
            <View className="flex-row justify-between items-start mb-2">
              <Text className="text-sm font-semibold text-clinical-primary">
                {entry.treatment_logs?.isotope ?? "Treatment"}
                {entry.treatment_logs?.cycle_number ? ` · Cycle ${entry.treatment_logs.cycle_number}` : ""}
              </Text>
              <Text className="text-xs text-gray-500">{entry.log_date}</Text>
            </View>
            <Text className="text-sm text-gray-700">{entry.precaution_notes ?? "—"}</Text>
          </View>
        ))
      )}
      <View className="h-8" />
    </ScrollView>
  );
}