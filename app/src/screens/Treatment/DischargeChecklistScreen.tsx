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
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { DischargeChecklistItem, IsotopeType } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "DischargeChecklist">;

interface CycleOption {
  id: string;
  cycle_number: number | null;
  isotope: IsotopeType;
  administered_date: string | null;
}

export default function DischargeChecklistScreen({ route }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const [cycles, setCycles] = useState<CycleOption[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [items, setItems] = useState<DischargeChecklistItem[]>([]);
  const [templateMissing, setTemplateMissing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [doseRate, setDoseRate] = useState("");
  const [doseRateUnit, setDoseRateUnit] = useState("");
  const [completedBy, setCompletedBy] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCycles = useCallback(async () => {
    setError(null);
    const { data, error: queryError } = await supabase
      .from("treatment_logs")
      .select("id, cycle_number, isotope, administered_date")
      .eq("patient_id", patientId)
      .not("cycle_number", "is", null)
      .order("administered_date", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }
    const available = (data ?? []) as CycleOption[];
    setCycles(available);
    setSelectedCycleId((current) => current ?? available[0]?.id ?? null);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  const selectedCycle = useMemo(
    () => cycles.find((cycle) => cycle.id === selectedCycleId) ?? null,
    [cycles, selectedCycleId]
  );

  useEffect(() => {
    if (!selectedCycle || !profile?.institution_id) {
      setItems([]);
      setTemplateMissing(false);
      setCompleted(false);
      return;
    }

    let cancelled = false;
    setItems([]);
    setTemplateMissing(false);
    setCompleted(false);
    setError(null);

    (async () => {
      const [templateResult, existingResult] = await Promise.all([
        supabase
          .from("discharge_checklist_templates")
          .select("checklist_items")
          .eq("institution_id", profile.institution_id)
          .eq("isotope", selectedCycle.isotope)
          .maybeSingle(),
        supabase
          .from("discharge_checklists")
          .select("id")
          .eq("treatment_log_id", selectedCycle.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      if (templateResult.error || existingResult.error) {
        setError(templateResult.error?.message ?? existingResult.error?.message ?? "Unable to load checklist.");
        return;
      }
      setCompleted(Boolean(existingResult.data));
      const templateItems = (templateResult.data?.checklist_items ?? []) as { item: string }[];
      setTemplateMissing(templateItems.length === 0);
      setItems(templateItems.map(({ item }) => ({ item, checked: false, checked_by: null })));
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.institution_id, selectedCycle]);

  const toggleItem = (index: number) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const handleSave = async () => {
    setError(null);
    if (!profile?.institution_id || !selectedCycle) {
      setError("Select a recorded treatment cycle before completing the checklist.");
      return;
    }
    if (templateMissing) {
      setError("There is no institution-approved checklist on file for this isotope.");
      return;
    }
    if (completed) {
      setError("A discharge checklist has already been saved for this cycle.");
      return;
    }
    if (!completedBy.trim()) {
      setError("Enter the name of the person completing this checklist.");
      return;
    }
    if (items.some((item) => !item.checked)) {
      setError("Confirm each configured checklist item before signing.");
      return;
    }
    if (doseRate.trim() && (!Number.isFinite(Number(doseRate)) || Number(doseRate) < 0)) {
      setError("Enter a non-negative dose-rate value or leave it blank.");
      return;
    }
    if (doseRate.trim() && !doseRateUnit.trim()) {
      setError("Enter the recorded dose-rate unit or leave the value blank.");
      return;
    }

    setSaving(true);
    const checkedItems = items.map((item) => ({
      ...item,
      checked_by: item.checked ? completedBy.trim() : null,
    }));
    const { data: inserted, error: insertError } = await supabase
      .from("discharge_checklists")
      .insert({
        patient_id: patientId,
        treatment_log_id: selectedCycle.id,
        institution_id: profile.institution_id,
        isotope: selectedCycle.isotope,
        checklist_items: checkedItems,
        dose_rate_at_discharge: doseRate.trim() ? Number(doseRate) : null,
        dose_rate_unit: doseRateUnit.trim() || null,
        completed_by: completedBy.trim(),
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
      tableName: "discharge_checklists",
      recordId: inserted.id,
    });
    setCompleted(true);
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
      <Text className="text-lg font-semibold text-clinical-primary mb-1">Discharge Checklist</Text>
      <Text className="text-xs text-gray-500 mb-4">
        Uses the institution-configured checklist for the selected isotope.
      </Text>

      {cycles.length === 0 ? (
        <Text className="text-sm text-gray-500 py-8 text-center">
          No treatment cycles are recorded for this patient.
        </Text>
      ) : (
        <>
          <Text className="text-xs font-medium text-gray-600 mb-2">Treatment cycle</Text>
          <View className="flex-row flex-wrap mb-4">
            {cycles.map((cycle) => (
              <Pressable
                key={cycle.id}
                onPress={() => setSelectedCycleId(cycle.id)}
                className={`px-3 py-2 mr-2 mb-2 rounded-lg border ${
                  cycle.id === selectedCycleId
                    ? "bg-clinical-primary border-clinical-primary"
                    : "bg-clinical-card border-gray-300"
                }`}
              >
                <Text className={cycle.id === selectedCycleId ? "text-white text-xs" : "text-gray-700 text-xs"}>
                  C{cycle.cycle_number} · {cycle.isotope} · {cycle.administered_date ?? "date not recorded"}
                </Text>
              </Pressable>
            ))}
          </View>

          {completed ? (
            <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <Text className="text-sm font-medium text-green-800">
                A discharge checklist is already on file for this cycle.
              </Text>
            </View>
          ) : null}

          {templateMissing ? (
            <View className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <Text className="text-sm font-semibold text-amber-900">Checklist not on file</Text>
              <Text className="text-xs text-amber-900 mt-1">
                This institution has not configured an approved {selectedCycle?.isotope} checklist. No checklist items have been generated.
              </Text>
            </View>
          ) : null}

          {items.map((item, index) => (
            <Pressable
              key={`${item.item}-${index}`}
              onPress={() => toggleItem(index)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.checked }}
              className="flex-row items-start bg-clinical-card border border-gray-100 rounded-lg p-3 mb-2"
            >
              <View className={`w-5 h-5 border rounded mr-3 items-center justify-center ${item.checked ? "bg-clinical-primary border-clinical-primary" : "border-gray-400"}`}>
                {item.checked ? <Text className="text-white text-xs">✓</Text> : null}
              </View>
              <Text className="text-sm text-gray-700 flex-1">{item.item}</Text>
            </Pressable>
          ))}

          {!templateMissing && !completed ? (
            <>
              <Text className="text-xs font-medium text-gray-600 mt-4 mb-1">Dose rate at discharge (as recorded)</Text>
              <View className="flex-row">
                <AppTextInput
                  value={doseRate}
                  onChangeText={setDoseRate}
                  keyboardType="decimal-pad"
                  placeholder="Optional value"
                  className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card flex-1 mr-2"
                />
                <AppTextInput
                  value={doseRateUnit}
                  onChangeText={setDoseRateUnit}
                  placeholder="Unit"
                  className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card w-28"
                />
              </View>

              <Text className="text-xs font-medium text-gray-600 mb-1">Completed by</Text>
              <AppTextInput
                value={completedBy}
                onChangeText={setCompletedBy}
                placeholder="Type full name to confirm completion"
                autoCapitalize="words"
                className="border-b-2 border-gray-500 rounded-none px-2 py-3 mb-4 bg-transparent"
              />
              <Text className="text-[10px] text-gray-400 mb-4">
                Typed name serves as the completion confirmation. Checked items will be attributed to this name.
              </Text>

              {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}
              <Pressable
                onPress={handleSave}
                disabled={saving || items.length === 0 || items.some((item) => !item.checked) || !completedBy.trim()}
                className={`rounded-lg py-3 items-center mb-10 ${items.length > 0 && items.every((item) => item.checked) && completedBy.trim() ? "bg-clinical-primary" : "bg-gray-400"}`}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium">Complete and Save Checklist</Text>}
              </Pressable>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}