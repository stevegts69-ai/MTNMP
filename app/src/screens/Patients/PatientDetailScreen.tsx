import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ActivityIndicator, ScrollView, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { logAudit } from "../../lib/audit";
import type { Patient, ToxicityAlert } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "PatientDetail">;

const PATIENTS_CACHE_KEY = "cached_patients_list";

export default function PatientDetailScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((s) => s.profile);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [toxicityAlerts, setToxicityAlerts] = useState<ToxicityAlert[]>([]);
  const [toxicityAlertError, setToxicityAlertError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const loadToxicityAlerts = useCallback(async () => {
    const { data, error: alertQueryError } = await supabase
      .from("toxicity_alerts")
      .select("*")
      .eq("patient_id", patientId)
      .eq("acknowledged", false)
      .order("created_at", { ascending: false });

    if (alertQueryError) {
      setToxicityAlertError(alertQueryError.message);
      return;
    }
    setToxicityAlerts((data ?? []) as ToxicityAlert[]);
    setToxicityAlertError(null);
  }, [patientId]);

  useEffect(() => {
    loadToxicityAlerts();
    const unsubscribe = navigation.addListener("focus", loadToxicityAlerts);
    return unsubscribe;
  }, [navigation, loadToxicityAlerts]);

  const canAcknowledgeToxicity =
    profile?.credential_verified === true &&
    (profile.role === "admin" || profile.role === "physician");

  const acknowledgeToxicityAlert = async (alert: ToxicityAlert) => {
    if (!profile || !canAcknowledgeToxicity) return;
    setAcknowledgingId(alert.id);
    setToxicityAlertError(null);
    const { error: updateError } = await supabase
      .from("toxicity_alerts")
      .update({
        acknowledged: true,
        acknowledged_by: profile.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", alert.id)
      .eq("acknowledged", false);
    setAcknowledgingId(null);

    if (updateError) {
      setToxicityAlertError(updateError.message);
      return;
    }

    await logAudit({
      userId: profile.id,
      institutionId: profile.institution_id,
      action: "update",
      tableName: "toxicity_alerts",
      recordId: alert.id,
    });
    setToxicityAlerts((current) => current.filter((item) => item.id !== alert.id));
  };

  useEffect(() => {
    (async () => {
      const { data, error: fetchError } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();

      if (!fetchError && data) {
        setPatient(data as Patient);
        setIsOffline(false);
        setLoading(false);
        return;
      }

      // Fetch failed — most likely no connectivity. Fall back to the
      // patient list's cache (written by PatientListScreen) rather than
      // blocking navigation entirely, since imaging/metabolic/treatment
      // screens beyond this one only need the patientId to function.
      try {
        const cached = await AsyncStorage.getItem(PATIENTS_CACHE_KEY);
        if (cached) {
          const cachedPatients = JSON.parse(cached) as Patient[];
          const match = cachedPatients.find((p) => p.id === patientId);
          if (match) {
            setPatient(match);
            setIsOffline(true);
            setLoading(false);
            return;
          }
        }
      } catch {
        // No usable cache either — fall through to the error state below.
      }

      setError(fetchError?.message ?? "Patient not found.");
      setLoading(false);
    })();
  }, [patientId]);

  // Log a "view" event once per screen visit — this is the core clinical
  // audit trail entry: who looked at which patient record, and when.
  useEffect(() => {
    if (profile) {
      logAudit({
        userId: profile.id,
        institutionId: profile.institution_id,
        action: "view",
        tableName: "patients",
        recordId: patientId,
      });
    }
  }, [profile, patientId]);

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
      {isOffline ? (
        <View className="bg-clinical-warn/10 border border-clinical-warn rounded-lg px-3 py-2 mb-4">
          <Text className="text-xs text-clinical-warn text-center">
            Offline — showing cached patient details
          </Text>
        </View>
      ) : null}

      {toxicityAlertError ? (
        <Text className="text-clinical-danger text-xs mb-3">{toxicityAlertError}</Text>
      ) : null}
      {toxicityAlerts.map((alert) => (
        <View key={alert.id} className="bg-red-50 border border-red-300 rounded-lg p-4 mb-3">
          <Text className="text-sm font-semibold text-red-800">CTCAE toxicity alert</Text>
          <Text className="text-xs text-red-800 mt-1">{alert.event_summary}</Text>
          {canAcknowledgeToxicity ? (
            <Pressable
              onPress={() => acknowledgeToxicityAlert(alert)}
              disabled={acknowledgingId === alert.id}
              className="self-start border border-red-700 rounded-md px-3 py-2 mt-3"
            >
              <Text className="text-xs font-semibold text-red-800">
                {acknowledgingId === alert.id ? "Saving..." : "Acknowledge"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      <Text className="text-xl font-semibold text-clinical-primary mb-1">

            <Pressable
              onPress={() => navigation.navigate("DischargeChecklist", { patientId: patient.id })}
              className="mt-3 p-4 bg-clinical-card rounded-xl border border-gray-100"
            >
              <Text className="text-clinical-primary font-medium text-center">Discharge Checklist</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("PatientInstructions", { patientId: patient.id })}
              className="mt-3 p-4 bg-clinical-card rounded-xl border border-gray-100 mb-8"
            >
              <Text className="text-clinical-primary font-medium text-center">Patient Instructions</Text>
            </Pressable>
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
        className="mt-6 p-4 bg-clinical-card rounded-xl border border-gray-100"
      >
        <Text className="text-clinical-primary font-medium text-center">View Imaging</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("PatientMetabolic", { patientId: patient.id })}
        className="mt-3 p-4 bg-clinical-card rounded-xl border border-gray-100"
      >

      <Pressable
        onPress={() => navigation.navigate("CycleSchedule")}
        className="mt-3 p-4 bg-clinical-card rounded-xl border border-gray-100 mb-8"
      >
        <Text className="text-clinical-primary font-medium text-center">Institution Cycle Calendar</Text>
      </Pressable>
        <Text className="text-clinical-primary font-medium text-center">Metabolic Monitoring</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("PatientTreatment", { patientId: patient.id })}
        className="mt-3 p-4 bg-clinical-card rounded-xl border border-gray-100"
      >
        <Text className="text-clinical-primary font-medium text-center">Treatment Log</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("DosimetryHistory", { patientId: patient.id })}
        className="mt-3 p-4 bg-clinical-card rounded-xl border border-gray-100"
      >
        <Text className="text-clinical-primary font-medium text-center">Dosimetry Records</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("ToxicityHistory", { patientId: patient.id })}
        className="mt-3 p-4 bg-clinical-card rounded-xl border border-gray-100"
      >
        <Text className="text-clinical-primary font-medium text-center">Toxicity Assessments</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("TumorBoardReport", { patientId: patient.id })}
        className="mt-3 p-4 bg-clinical-primary rounded-xl mb-8"
      >
        <Text className="text-white font-medium text-center">Tumor Board Report</Text>
      </Pressable>

      <Pressable
        onPress={() => navigation.navigate("ResponseAssessment", { patientId: patient.id })}
        className="mt-3 p-4 bg-clinical-card rounded-xl border border-gray-100"
      >
        <Text className="text-clinical-primary font-medium text-center">Response Assessment</Text>
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