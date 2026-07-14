import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { logAudit } from "../../lib/audit";
import type { TreatmentLog } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "TreatmentLogDetail">;

interface OrganDoseRow {
  id: string;
  organ: string;
  dose_value: number | null;
  dose_limit_reference: number | null;
  recorded_at: string;
}

interface SafetyAlertRow {
  id: string;
  alert_type: string;
  threshold_value: number | null;
  entered_value: number | null;
  triggered_at: string;
}

export default function TreatmentLogDetailScreen({ route, navigation }: Props) {
  const { treatmentLogId } = route.params;
  const profile = useAuthStore((s) => s.profile);

  const [log, setLog] = useState<TreatmentLog | null>(null);
  const [doses, setDoses] = useState<OrganDoseRow[]>([]);
  const [alerts, setAlerts] = useState<SafetyAlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [{ data: logData }, { data: doseData }, { data: alertData }] = await Promise.all([
      supabase.from("treatment_logs").select("*").eq("id", treatmentLogId).single(),
      supabase
        .from("organ_dose_logs")
        .select("*")
        .eq("treatment_log_id", treatmentLogId)
        .order("recorded_at", { ascending: false }),
      supabase
        .from("safety_alerts")
        .select("*")
        .eq("treatment_log_id", treatmentLogId)
        .order("triggered_at", { ascending: false }),
    ]);

    if (logData) setLog(logData as TreatmentLog);
    if (doseData) setDoses(doseData as OrganDoseRow[]);
    if (alertData) setAlerts(alertData as SafetyAlertRow[]);
    setLoading(false);
  }, [treatmentLogId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  // Log a "view" event once per screen visit, not once per re-fetch.
  useEffect(() => {
    if (profile && treatmentLogId) {
      logAudit({
        userId: profile.id,
        institutionId: profile.institution_id,
        action: "view",
        tableName: "treatment_logs",
        recordId: treatmentLogId,
      });
    }
  }, [profile, treatmentLogId]);

  if (loading || !log) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-5 pt-5">
      <Text className="text-lg font-semibold text-clinical-primary mb-1">{log.isotope}</Text>
      <Text className="text-xs text-gray-500 mb-6">
        {log.target_receptor_or_tissue ?? "—"} · {log.administered_date ?? "date not recorded"}
      </Text>

      {alerts.length > 0 ? (
        <View className="bg-red-50 border border-clinical-danger rounded-xl p-4 mb-5">
          <Text className="text-clinical-danger font-medium mb-2">Safety Flags</Text>
          {alerts.map((a) => (
            <Text key={a.id} className="text-xs text-clinical-danger">
              {a.alert_type.replace(/_/g, " ")}: {a.entered_value} exceeds reference {a.threshold_value}
            </Text>
          ))}
          <Text className="text-xs text-gray-500 mt-2">
            Flagged for physician review — not an automated clinical determination.
          </Text>
        </View>
      ) : null}

      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-sm font-medium text-gray-600">Organ Dose Readings</Text>
        <Pressable onPress={() => navigation.navigate("NewOrganDose", { treatmentLogId })}>
          <Text className="text-clinical-primary text-sm font-medium">+ Add</Text>
        </Pressable>
      </View>

      {doses.length === 0 ? (
        <Text className="text-gray-400 text-center mt-4 mb-10">No organ dose readings logged yet.</Text>
      ) : (
        doses.map((d) => (
          <View key={d.id} className="bg-clinical-card rounded-xl p-4 mb-3 border border-gray-100">
            <Text className="text-sm font-medium text-gray-800">{d.organ}</Text>
            <Text className="text-xs text-gray-500 mt-1">
              Dose: {d.dose_value ?? "—"}
              {d.dose_limit_reference != null ? ` (limit: ${d.dose_limit_reference})` : ""}
            </Text>
          </View>
        ))
      )}
      <View className="h-10" />
    </ScrollView>
  );
}