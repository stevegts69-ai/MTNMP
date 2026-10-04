import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import AppTextInput from "../../components/AppTextInput";
import { logAudit } from "../../lib/audit";
import { summarizeRecist, percentChangeFromFirst } from "../../lib/responseAssessment";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type {
  LesionMeasurement,
  LesionMeasurementMethod,
  PercistCategory,
} from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "ResponseAssessment">;

const PERCIST_CATEGORIES: PercistCategory[] = ["CMR", "PMR", "SMD", "PMD"];

function formatChange(change: number | null): string {
  if (change === null) return "—";
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return `${sign}${Math.abs(change).toFixed(1)}%`;
}

export default function ResponseAssessmentScreen({ route }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const [records, setRecords] = useState<LesionMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [method, setMethod] = useState<LesionMeasurementMethod>("RECIST_1_1");
  const [lesionLabel, setLesionLabel] = useState("");
  const [timepointDate, setTimepointDate] = useState(new Date().toISOString().slice(0, 10));
  const [measurement, setMeasurement] = useState("");
  const [isTargetLesion, setIsTargetLesion] = useState(true);
  const [isNewLesion, setIsNewLesion] = useState(false);
  const [manualPercistCategory, setManualPercistCategory] = useState<PercistCategory | null>(null);
  const [notes, setNotes] = useState("");

  const loadRecords = useCallback(async () => {
    setError(null);
    const { data, error: queryError } = await supabase
      .from("lesion_measurements")
      .select("*")
      .eq("patient_id", patientId)
      .order("timepoint_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (queryError) setError(queryError.message);
    else setRecords((data ?? []) as LesionMeasurement[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const recistRecords = useMemo(
    () => records.filter((record) => record.method === "RECIST_1_1"),
    [records]
  );
  const percistRecords = useMemo(
    () => records.filter((record) => record.method === "PERCIST"),
    [records]
  );
  const recistSummary = useMemo(() => summarizeRecist(recistRecords), [recistRecords]);

  const lesionGroups = useMemo(() => {
    const activeRecords = method === "RECIST_1_1" ? recistRecords : percistRecords;
    const groups = new Map<string, LesionMeasurement[]>();
    for (const record of activeRecords) {
      const group = groups.get(record.lesion_label) ?? [];
      group.push(record);
      groups.set(record.lesion_label, group);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [method, recistRecords, percistRecords]);

  const handleMethodChange = (nextMethod: LesionMeasurementMethod) => {
    setMethod(nextMethod);
    setMeasurement("");
    setManualPercistCategory(null);
    setIsTargetLesion(nextMethod === "RECIST_1_1");
  };

  const handleSave = async () => {
    setError(null);
    if (!profile?.institution_id) {
      setError("Your institution profile is unavailable. Sign in again and retry.");
      return;
    }
    if (!lesionLabel.trim()) {
      setError("Enter a lesion label.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(timepointDate.trim())) {
      setError("Enter the timepoint date in YYYY-MM-DD format.");
      return;
    }
    const value = Number(measurement);
    if (!measurement.trim() || !Number.isFinite(value) || value < 0) {
      setError(method === "RECIST_1_1" ? "Enter a non-negative diameter in millimeters." : "Enter a non-negative SUVmax value.");
      return;
    }
    if (method === "RECIST_1_1" && isNewLesion && isTargetLesion) {
      setError("A new lesion cannot be marked as an established target lesion.");
      return;
    }

    setSaving(true);
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("lesion_measurements")
        .insert({
          patient_id: patientId,
          institution_id: profile.institution_id,
          lesion_label: lesionLabel.trim(),
          is_target_lesion: method === "RECIST_1_1" && isTargetLesion,
          timepoint_date: timepointDate.trim(),
          measurement_mm: method === "RECIST_1_1" ? value : null,
          suv_max: method === "PERCIST" ? value : null,
          method,
          is_new_lesion: isNewLesion,
          manual_percist_category: method === "PERCIST" ? manualPercistCategory : null,
          notes: notes.trim() || null,
          created_by: profile.id,
        })
        .select("id")
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }

      await logAudit({
        userId: profile.id,
        institutionId: profile.institution_id,
        action: "create",
        tableName: "lesion_measurements",
        recordId: inserted.id,
      });

      setLesionLabel("");
      setMeasurement("");
      setManualPercistCategory(null);
      setIsNewLesion(false);
      setNotes("");
      await loadRecords();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this measurement.");
    } finally {
      setSaving(false);
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
    <ScrollView className="flex-1 bg-clinical-bg px-4 pt-4" keyboardShouldPersistTaps="handled">
      <View className="flex-row mb-4">
        <MethodButton
          active={method === "RECIST_1_1"}
          label="RECIST 1.1"
          onPress={() => handleMethodChange("RECIST_1_1")}
        />
        <MethodButton
          active={method === "PERCIST"}
          label="PERCIST"
          onPress={() => handleMethodChange("PERCIST")}
        />
      </View>

      <Text className="text-sm font-semibold text-gray-700 mb-2">Add lesion measurement</Text>
      <AppTextInput
        value={lesionLabel}
        onChangeText={setLesionLabel}
        placeholder="Lesion label"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-3 bg-clinical-card"
      />
      <AppTextInput
        value={timepointDate}
        onChangeText={setTimepointDate}
        placeholder="YYYY-MM-DD"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-3 bg-clinical-card"
      />
      <AppTextInput
        value={measurement}
        onChangeText={setMeasurement}
        keyboardType="decimal-pad"
        placeholder={method === "RECIST_1_1" ? "Diameter (mm)" : "SUVmax"}
        className="border border-gray-300 rounded-lg px-4 py-3 mb-3 bg-clinical-card"
      />

      {method === "RECIST_1_1" ? (
        <CheckRow
          checked={isTargetLesion}
          label="Target lesion"
          onPress={() => setIsTargetLesion((value) => !value)}
        />
      ) : null}
      <CheckRow
        checked={isNewLesion}
        label="New lesion"
        onPress={() => setIsNewLesion((value) => !value)}
        danger
      />

      {method === "PERCIST" ? (
        <View className="bg-sky-50 border border-sky-200 rounded-lg p-3 mb-3">
          <Text className="text-xs text-sky-900">
            SUVmax is shown as a value trend only. It does not automatically determine a formal PERCIST category.
          </Text>
          <Text className="text-xs font-medium text-gray-700 mt-3 mb-2">
            Optional physician-entered PERCIST category
          </Text>
          <View className="flex-row flex-wrap">
            {PERCIST_CATEGORIES.map((category) => (
              <Pressable
                key={category}
                onPress={() => setManualPercistCategory((current) => current === category ? null : category)}
                accessibilityRole="radio"
                accessibilityState={{ selected: manualPercistCategory === category }}
                className={`px-3 py-2 rounded-md border mr-2 mb-2 ${
                  manualPercistCategory === category
                    ? "bg-clinical-primary border-clinical-primary"
                    : "bg-white border-gray-300"
                }`}
              >
                <Text className={manualPercistCategory === category ? "text-white text-xs" : "text-gray-700 text-xs"}>
                  {category}
                </Text>
              </Pressable>
            ))}
          </View>
          {manualPercistCategory ? (
            <Pressable onPress={() => setManualPercistCategory(null)}>
              <Text className="text-xs text-clinical-primary">Clear manual category</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <AppTextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Notes (optional)"
        multiline
        className="border border-gray-300 rounded-lg px-4 py-3 mb-3 bg-clinical-card h-20"
      />
      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}
      <Pressable
        onPress={handleSave}
        disabled={saving}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-6"
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium">Save Measurement</Text>}
      </Pressable>

      {method === "RECIST_1_1" ? (
        <RecistSummary records={recistRecords} summaries={summarizeRecist(recistRecords)} />
      ) : null}

      <Text className="text-base font-semibold text-clinical-primary mb-3">
        {method === "RECIST_1_1" ? "Target lesion history" : "SUVmax value trends"}
      </Text>
      {lesionGroups.length === 0 ? (
        <Text className="text-sm text-gray-400 text-center py-8">
          No {method === "RECIST_1_1" ? "RECIST" : "PERCIST"} measurements recorded yet.
        </Text>
      ) : (
        lesionGroups.map(([label, measurements]) => {
          const sorted = [...measurements].sort(
            (a, b) => a.timepoint_date.localeCompare(b.timepoint_date) || a.created_at.localeCompare(b.created_at)
          );
          const values = sorted.map((item) =>
            method === "RECIST_1_1" ? item.measurement_mm ?? 0 : item.suv_max ?? 0
          );
          const change = percentChangeFromFirst(values);

          return (
            <View key={label} className="bg-clinical-card border border-gray-100 rounded-lg p-4 mb-3">
              <View className="flex-row justify-between items-start mb-2">
                <Text className="text-sm font-semibold text-gray-800 flex-1">{label}</Text>
                {method === "PERCIST" ? (
                  <Text className="text-xs text-clinical-primary">Value trend {formatChange(change)}</Text>
                ) : null}
              </View>
              {method === "PERCIST" && sorted.length > 0 ? (
                <Text className="text-xs text-gray-600 mb-2">
                  SUVmax: {sorted[0].suv_max} → {sorted[sorted.length - 1].suv_max}, {formatChange(change)}
                </Text>
              ) : null}
              {sorted.map((item, index) => (
                <View key={item.id} className="flex-row justify-between items-center border-t border-gray-100 py-2">
                  <View className="flex-1">
                    <Text className="text-xs text-gray-600">{item.timepoint_date}</Text>
                    <Text className="text-xs text-gray-800 mt-0.5">
                      {method === "RECIST_1_1" ? `${item.measurement_mm} mm` : `SUVmax ${item.suv_max}`}
                      {method === "RECIST_1_1" && item.is_target_lesion ? " · Target" : ""}
                    </Text>
                    {item.manual_percist_category ? (
                      <Text className="text-xs text-sky-800 mt-1">
                        Physician-entered PERCIST: {item.manual_percist_category}
                      </Text>
                    ) : null}
                    {item.notes ? <Text className="text-xs text-gray-500 mt-1">{item.notes}</Text> : null}
                  </View>
                  <View className="items-end">
                    <Text className="text-xs text-gray-500">
                      {index === 0 ? "Baseline" : `${formatChange(percentChangeFromFirst(values.slice(0, index + 1)))} from first`}
                    </Text>
                    {item.is_new_lesion ? <NewLesionBadge /> : null}
                  </View>
                </View>
              ))}
            </View>
          );
        })
      )}
      <View className="h-8" />
    </ScrollView>
  );
}

function RecistSummary({
  records,
  summaries,
}: {
  records: LesionMeasurement[];
  summaries: ReturnType<typeof summarizeRecist>;
}) {
  if (summaries.length === 0) return null;
  return (
    <View className="mb-6">
      <Text className="text-base font-semibold text-clinical-primary mb-2">RECIST 1.1 summary</Text>
      <Text className="text-[11px] text-gray-500 mb-3">
        Computed from recorded target-lesion diameter sums, baseline, nadir, and new-lesion flags. Verify raw measurements before interpretation.
      </Text>
      {summaries.map((summary) => (
        <View
          key={summary.date}
          className={`rounded-lg border p-3 mb-2 ${summary.hasNewLesion ? "bg-red-50 border-red-300" : "bg-clinical-card border-gray-100"}`}
        >
          {summary.hasNewLesion ? (
            <Text className="text-xs text-red-800 font-semibold mb-1">NEW LESION — RECIST category overridden to PD</Text>
          ) : null}
          <Text className="text-sm font-semibold text-gray-800">
            {summary.date} · {summary.category}
          </Text>
          <Text className="text-xs text-gray-600 mt-1">
            Target diameter sum: {summary.targetLesionSum.toFixed(1)} mm · Change from baseline: {formatChange(summary.percentChangeFromBaseline)}
          </Text>
        </View>
      ))}
      {records.some((record) => record.is_new_lesion) ? (
        <Text className="text-[11px] text-red-700">
          A recorded new lesion overrides the computed RECIST category at and after its timepoint.
        </Text>
      ) : null}
    </View>
  );
}

function MethodButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      className={`px-4 py-2 rounded-lg mr-2 border ${
        active ? "bg-clinical-primary border-clinical-primary" : "bg-clinical-card border-gray-300"
      }`}
    >
      <Text className={active ? "text-white text-sm" : "text-gray-700 text-sm"}>{label}</Text>
    </Pressable>
  );
}

function CheckRow({
  checked,
  label,
  onPress,
  danger = false,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-center mb-3"
    >
      <View className={`w-5 h-5 rounded border mr-2 items-center justify-center ${checked ? "bg-clinical-primary border-clinical-primary" : "border-gray-400"}`}>
        {checked ? <Text className="text-white text-xs">✓</Text> : null}
      </View>
      <Text className={`text-xs ${danger ? "font-semibold text-red-700" : "text-gray-700"}`}>{label}</Text>
    </Pressable>
  );
}

function NewLesionBadge() {
  return (
    <View className="bg-red-100 border border-red-300 rounded px-2 py-1 mt-1">
      <Text className="text-[10px] font-bold text-red-800">NEW LESION</Text>
    </View>
  );
}