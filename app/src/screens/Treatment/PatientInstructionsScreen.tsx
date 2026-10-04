import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { logAudit } from "../../lib/audit";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { DischargeInstructionTemplate, IsotopeType, Patient } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "PatientInstructions">;
type InstructionLanguage = "en" | "sw";

interface InstitutionContacts {
  name: string;
  emergency_contact_name: string | null;
  emergency_phone: string | null;
  after_hours_phone: string | null;
}

const ISOTOPES: { value: IsotopeType; label: string }[] = [
  { value: "Lu177", label: "Lu-177" },
  { value: "Y90", label: "Y-90" },
  { value: "I131", label: "I-131" },
  { value: "Ra223", label: "Ra-223" },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function PatientInstructionsScreen({ route }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [institution, setInstitution] = useState<InstitutionContacts | null>(null);
  const [isotope, setIsotope] = useState<IsotopeType>("Lu177");
  const [language, setLanguage] = useState<InstructionLanguage>("en");
  const [template, setTemplate] = useState<DischargeInstructionTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPatientAndInstitution = useCallback(async () => {
    setError(null);
    const { data: patientData, error: patientError } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patientId)
      .single();
    if (patientError || !patientData) {
      setError(patientError?.message ?? "Patient not found.");
      setLoading(false);
      return;
    }
    const currentPatient = patientData as Patient;
    setPatient(currentPatient);
    const { data: institutionData, error: institutionError } = await supabase
      .from("institutions")
      .select("name, emergency_contact_name, emergency_phone, after_hours_phone")
      .eq("id", currentPatient.institution_id)
      .maybeSingle();
    if (institutionError) setError(institutionError.message);
    else setInstitution((institutionData as InstitutionContacts | null) ?? null);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadPatientAndInstitution();
  }, [loadPatientAndInstitution]);

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;
    setTemplate(null);
    setError(null);
    (async () => {
      const { data, error: templateError } = await supabase
        .from("discharge_instruction_templates")
        .select("*")
        .eq("institution_id", patient.institution_id)
        .eq("isotope", isotope)
        .eq("language", language)
        .maybeSingle();
      if (cancelled) return;
      if (templateError) setError(templateError.message);
      else setTemplate((data as DischargeInstructionTemplate | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [patient, isotope, language]);

  const handleExport = async () => {
    if (!patient || !profile) {
      setError("Patient or signed-in profile information is unavailable.");
      return;
    }
    setExporting(true);
    setError(null);
    const instructions = template?.body_text.trim() || "Instructions are not on file.";
    const emergencyContact = institution?.emergency_contact_name?.trim() || "—";
    const emergencyPhone = institution?.emergency_phone?.trim() || "—";
    const afterHoursPhone = institution?.after_hours_phone?.trim() || "—";
    const html = `
      <!doctype html>
      <html><head><meta charset="utf-8" />
        <style>
          @page { margin: 20mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #25343c; }
          h1 { color: #1e3a5f; font-size: 20pt; }
          h2 { color: #1e3a5f; font-size: 13pt; margin-top: 24px; border-bottom: 1px solid #d8e0e4; padding-bottom: 6px; }
          .meta { color: #596a73; font-size: 10pt; }
          .body { white-space: pre-wrap; line-height: 1.55; }
          .contacts { background: #f4f7f8; padding: 12px; border-left: 4px solid #1e3a5f; }
          .not-filed { color: #596a73; font-style: italic; }
        </style>
      </head><body>
        <h1>Discharge Instructions</h1>
        <p class="meta">${escapeHtml(institution?.name ?? "Institution")} · ${escapeHtml(patient.full_name)} · ${escapeHtml(patient.mrn)}</p>
        <p class="meta">${escapeHtml(ISOTOPES.find((item) => item.value === isotope)?.label ?? isotope)} · ${language === "en" ? "English" : "Kiswahili"}</p>
        <h2>Institution-provided instructions</h2>
        <div class="body${template?.body_text.trim() ? "" : " not-filed"}">${escapeHtml(instructions)}</div>
        <h2>Emergency contacts</h2>
        <div class="contacts">
          <p><strong>Contact:</strong> ${escapeHtml(emergencyContact)}</p>
          <p><strong>Emergency phone:</strong> ${escapeHtml(emergencyPhone)}</p>
          <p><strong>After-hours phone:</strong> ${escapeHtml(afterHoursPhone)}</p>
          ${!institution?.emergency_phone && !institution?.after_hours_phone ? '<p class="not-filed">Emergency contact details are not on file.</p>' : ""}
        </div>
      </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await logAudit({
        userId: profile.id,
        institutionId: patient.institution_id,
        action: "export",
        tableName: "discharge_instruction_templates",
        recordId: template?.id ?? null,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      } else {
        Alert.alert("PDF ready", "Sharing is unavailable on this device.");
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Unable to create the PDF.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-5 pt-4">
      <Text className="text-lg font-semibold text-clinical-primary mb-1">Patient Instructions</Text>
      <Text className="text-xs text-gray-500 mb-4">
        {patient?.full_name} · {patient?.mrn}
      </Text>

      <Text className="text-xs font-medium text-gray-600 mb-2">Isotope</Text>
      <View className="flex-row flex-wrap mb-4">
        {ISOTOPES.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setIsotope(item.value)}
            className={`px-3 py-2 mr-2 mb-2 rounded-lg border ${isotope === item.value ? "bg-clinical-primary border-clinical-primary" : "bg-clinical-card border-gray-300"}`}
          >
            <Text className={isotope === item.value ? "text-white text-xs" : "text-gray-700 text-xs"}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-xs font-medium text-gray-600 mb-2">Language</Text>
      <View className="flex-row mb-4">
        {(["en", "sw"] as const).map((item) => (
          <Pressable
            key={item}
            onPress={() => setLanguage(item)}
            className={`px-4 py-2 mr-2 rounded-lg border ${language === item ? "bg-clinical-primary border-clinical-primary" : "bg-clinical-card border-gray-300"}`}
          >
            <Text className={language === item ? "text-white text-xs" : "text-gray-700 text-xs"}>
              {item === "en" ? "English" : "Kiswahili"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="bg-clinical-card border border-gray-100 rounded-lg p-4 mb-4">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Institution-provided content</Text>
        {template?.body_text.trim() ? (
          <Text className="text-sm text-gray-700 leading-6">{template.body_text}</Text>
        ) : (
          <Text className="text-sm text-gray-500 italic">Instructions are not on file.</Text>
        )}
      </View>

      <View className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
        <Text className="text-sm font-semibold text-gray-700 mb-2">Emergency contacts</Text>
        <Text className="text-sm text-gray-600">
          {institution?.emergency_contact_name || "Contact not on file"}
        </Text>
        <Text className="text-sm text-gray-600 mt-1">
          Emergency: {institution?.emergency_phone || "Not on file"}
        </Text>
        <Text className="text-sm text-gray-600 mt-1">
          After hours: {institution?.after_hours_phone || "Not on file"}
        </Text>
      </View>

      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}
      <Pressable
        onPress={handleExport}
        disabled={exporting || !patient}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-10"
      >
        {exporting ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium">Export PDF</Text>}
      </Pressable>
    </ScrollView>
  );
}