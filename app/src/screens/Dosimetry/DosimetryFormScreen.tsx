import React, { useState } from "react";
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
import type {
  DosimetryCalculationMethod,
  DosimetryImagingTimepoint,
  DosimetryOrganDose,
  DosimetryTumorDose,
  IsotopeType,
} from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "DosimetryForm">;

type TimepointInput = { label: string; hours: string };
type OrganDoseInput = { organ: string; dose: string; tolerance: string };
type TumorDoseInput = { lesion: string; dose: string; volume: string };

const ISOTOPES: IsotopeType[] = ["Lu177", "Y90", "I131", "Ra223", "other"];
const METHODS: DosimetryCalculationMethod[] = [
  "MIRD",
  "voxel-based",
  "Monte Carlo",
  "other",
];

function parseOptionalNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isInvalidNonnegative(value: number | null): boolean {
  return value !== null && (!Number.isFinite(value) || value < 0);
}

export default function DosimetryFormScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const [cycleNumber, setCycleNumber] = useState("1");
  const [isotope, setIsotope] = useState<IsotopeType>("Lu177");
  const [calculationMethod, setCalculationMethod] =
    useState<DosimetryCalculationMethod>("MIRD");
  const [timepoints, setTimepoints] = useState<TimepointInput[]>([]);
  const [organDoses, setOrganDoses] = useState<OrganDoseInput[]>([]);
  const [tumorDoses, setTumorDoses] = useState<TumorDoseInput[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const cycle = Number(cycleNumber);
    if (!Number.isInteger(cycle) || cycle < 1) {
      setError("Cycle number must be a positive whole number.");
      return;
    }
    if (!profile?.institution_id) {
      setError("Your institution profile is unavailable. Sign in again and retry.");
      return;
    }

    const savedTimepoints: DosimetryImagingTimepoint[] = [];
    for (const [index, row] of timepoints.entries()) {
      if (!row.label.trim() && !row.hours.trim()) continue;
      const hours = parseOptionalNumber(row.hours);
      if (!row.label.trim() || hours === null || isInvalidNonnegative(hours)) {
        setError(`Complete imaging timepoint ${index + 1} with a label and non-negative time.`);
        return;
      }
      savedTimepoints.push({ label: row.label.trim(), hours_post_injection: hours });
    }

    const savedOrganDoses: DosimetryOrganDose[] = [];
    for (const [index, row] of organDoses.entries()) {
      if (!row.organ.trim() && !row.dose.trim() && !row.tolerance.trim()) continue;
      const dose = parseOptionalNumber(row.dose);
      const tolerance = parseOptionalNumber(row.tolerance);
      if (
        !row.organ.trim() ||
        dose === null ||
        isInvalidNonnegative(dose) ||
        isInvalidNonnegative(tolerance)
      ) {
        setError(`Complete organ dose ${index + 1} with an organ and non-negative dose.`);
        return;
      }
      savedOrganDoses.push({
        organ: row.organ.trim(),
        dose_gy: dose,
        tolerance_limit_gy: tolerance,
      });
    }

    const savedTumorDoses: DosimetryTumorDose[] = [];
    for (const [index, row] of tumorDoses.entries()) {
      if (!row.lesion.trim() && !row.dose.trim() && !row.volume.trim()) continue;
      const dose = parseOptionalNumber(row.dose);
      const volume = parseOptionalNumber(row.volume);
      if (
        !row.lesion.trim() ||
        dose === null ||
        isInvalidNonnegative(dose) ||
        isInvalidNonnegative(volume)
      ) {
        setError(`Complete tumor dose ${index + 1} with a lesion and non-negative dose.`);
        return;
      }
      savedTumorDoses.push({
        lesion_label: row.lesion.trim(),
        dose_gy: dose,
        volume_cc: volume,
      });
    }

    setSubmitting(true);
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("dosimetry_records")
        .insert({
          patient_id: patientId,
          institution_id: profile.institution_id,
          cycle_number: cycle,
          isotope,
          calculation_method: calculationMethod,
          imaging_timepoints: savedTimepoints,
          organ_doses: savedOrganDoses,
          tumor_doses: savedTumorDoses,
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
        tableName: "dosimetry_records",
        recordId: inserted.id,
      });
      navigation.goBack();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save the dosimetry record. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-clinical-bg px-5 pt-4"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-lg font-semibold text-clinical-primary mb-4">
        Structured Dosimetry
      </Text>

      <Text className="text-xs font-medium text-gray-600 mb-1">Cycle Number</Text>
      <AppTextInput
        value={cycleNumber}
        onChangeText={setCycleNumber}
        keyboardType="number-pad"
        placeholder="1"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
      />

      <Text className="text-xs font-medium text-gray-600 mb-1">Isotope</Text>
      <View className="flex-row flex-wrap mb-4">
        {ISOTOPES.map((option) => (
          <Pressable
            key={option}
            onPress={() => setIsotope(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isotope === option }}
            className={`px-4 py-2 rounded-lg mr-2 mb-2 border ${
              isotope === option
                ? "bg-clinical-primary border-clinical-primary"
                : "bg-clinical-card border-gray-300"
            }`}
          >
            <Text className={isotope === option ? "text-white" : "text-gray-700"}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-xs font-medium text-gray-600 mb-1">Calculation Method</Text>
      <View className="flex-row flex-wrap mb-5">
        {METHODS.map((option) => (
          <Pressable
            key={option}
            onPress={() => setCalculationMethod(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: calculationMethod === option }}
            className={`px-4 py-2 rounded-lg mr-2 mb-2 border ${
              calculationMethod === option
                ? "bg-clinical-primary border-clinical-primary"
                : "bg-clinical-card border-gray-300"
            }`}
          >
            <Text className={calculationMethod === option ? "text-white" : "text-gray-700"}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle title="Imaging Timepoints" />
      {timepoints.map((row, index) => (
        <View key={index} className="bg-clinical-card border border-gray-100 rounded-lg p-3 mb-3">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm font-medium text-gray-700">Timepoint {index + 1}</Text>
            <RemoveButton onPress={() => setTimepoints((rows) => rows.filter((_, i) => i !== index))} />
          </View>
          <AppTextInput
            value={row.label}
            onChangeText={(label) =>
              setTimepoints((rows) => rows.map((item, i) => (i === index ? { ...item, label } : item)))
            }
            placeholder="Label, e.g. post-therapy SPECT"
            className="border border-gray-300 rounded-lg px-3 py-2 mb-2 bg-white"
          />
          <AppTextInput
            value={row.hours}
            onChangeText={(hours) =>
              setTimepoints((rows) => rows.map((item, i) => (i === index ? { ...item, hours } : item)))
            }
            keyboardType="decimal-pad"
            placeholder="Hours post-injection"
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
          />
        </View>
      ))}
      <AddButton
        label="Add Imaging Timepoint"
        onPress={() => setTimepoints((rows) => [...rows, { label: "", hours: "" }])}
      />

      <SectionTitle title="Organ Doses (Gy)" />
      {organDoses.map((row, index) => {
        const dose = parseOptionalNumber(row.dose);
        const tolerance = parseOptionalNumber(row.tolerance);
        const nearTolerance =
          dose !== null &&
          Number.isFinite(dose) &&
          tolerance !== null &&
          Number.isFinite(tolerance) &&
          dose >= tolerance * 0.8;

        return (
          <View key={index} className="bg-clinical-card border border-gray-100 rounded-lg p-3 mb-3">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-medium text-gray-700">Organ {index + 1}</Text>
              <RemoveButton onPress={() => setOrganDoses((rows) => rows.filter((_, i) => i !== index))} />
            </View>
            <AppTextInput
              value={row.organ}
              onChangeText={(organ) =>
                setOrganDoses((rows) => rows.map((item, i) => (i === index ? { ...item, organ } : item)))
              }
              placeholder="Organ"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-2 bg-white"
            />
            <AppTextInput
              value={row.dose}
              onChangeText={(doseValue) =>
                setOrganDoses((rows) => rows.map((item, i) => (i === index ? { ...item, dose: doseValue } : item)))
              }
              keyboardType="decimal-pad"
              placeholder="Dose (Gy)"
              className="border border-gray-300 rounded-lg px-3 py-2 mb-2 bg-white"
            />
            <AppTextInput
              value={row.tolerance}
              onChangeText={(toleranceValue) =>
                setOrganDoses((rows) => rows.map((item, i) => (i === index ? { ...item, tolerance: toleranceValue } : item)))
              }
              keyboardType="decimal-pad"
              placeholder="Tolerance limit (Gy), optional"
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
            />
            {nearTolerance ? (
              <View className="self-start bg-amber-100 rounded-full px-3 py-1 mt-2">
                <Text className="text-xs font-medium text-amber-800">
                  ≥80% of entered tolerance limit
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
      <AddButton
        label="Add Organ Dose"
        onPress={() => setOrganDoses((rows) => [...rows, { organ: "", dose: "", tolerance: "" }])}
      />

      <SectionTitle title="Tumor Doses (Gy)" />
      {tumorDoses.map((row, index) => (
        <View key={index} className="bg-clinical-card border border-gray-100 rounded-lg p-3 mb-3">
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm font-medium text-gray-700">Lesion {index + 1}</Text>
            <RemoveButton onPress={() => setTumorDoses((rows) => rows.filter((_, i) => i !== index))} />
          </View>
          <AppTextInput
            value={row.lesion}
            onChangeText={(lesion) =>
              setTumorDoses((rows) => rows.map((item, i) => (i === index ? { ...item, lesion } : item)))
            }
            placeholder="Lesion label"
            className="border border-gray-300 rounded-lg px-3 py-2 mb-2 bg-white"
          />
          <AppTextInput
            value={row.dose}
            onChangeText={(doseValue) =>
              setTumorDoses((rows) => rows.map((item, i) => (i === index ? { ...item, dose: doseValue } : item)))
            }
            keyboardType="decimal-pad"
            placeholder="Dose (Gy)"
            className="border border-gray-300 rounded-lg px-3 py-2 mb-2 bg-white"
          />
          <AppTextInput
            value={row.volume}
            onChangeText={(volume) =>
              setTumorDoses((rows) => rows.map((item, i) => (i === index ? { ...item, volume } : item)))
            }
            keyboardType="decimal-pad"
            placeholder="Volume (cc), optional"
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
          />
        </View>
      ))}
      <AddButton
        label="Add Tumor Dose"
        onPress={() => setTumorDoses((rows) => [...rows, { lesion: "", dose: "", volume: "" }])}
      />

      <SectionTitle title="Notes" />
      <AppTextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        multiline
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card h-24"
      />

      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        className="bg-clinical-primary rounded-lg py-3 items-center mt-2 mb-10"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-medium">Save Dosimetry Record</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text className="text-sm font-semibold text-gray-700 mt-5 mb-2">{title}</Text>;
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="border border-clinical-primary rounded-lg py-2.5 items-center mb-2"
    >
      <Text className="text-sm font-medium text-clinical-primary">+ {label}</Text>
    </Pressable>
  );
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Remove row" hitSlop={8}>
      <Text className="text-sm text-clinical-danger">Remove</Text>
    </Pressable>
  );
}