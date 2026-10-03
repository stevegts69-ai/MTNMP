import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import AppTextInput from "../../components/AppTextInput";
import { logAudit } from "../../lib/audit";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { ToxicityAssessmentType, ToxicityEvent } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "ToxicityAssessment">;

const COMMON_EVENTS: { category: string; term: string }[] = [
  { category: "Hematologic", term: "Anemia" },
  { category: "Hematologic", term: "Neutrophil count decreased" },
  { category: "Hematologic", term: "Platelet count decreased" },
  { category: "Hematologic", term: "White blood cell decreased" },
  { category: "Renal", term: "Creatinine increased" },
  { category: "Renal", term: "Acute kidney injury" },
  { category: "Renal", term: "Proteinuria" },
  { category: "Renal", term: "Renal failure" },
  { category: "Hepatic", term: "Alanine aminotransferase increased" },
  { category: "Hepatic", term: "Aspartate aminotransferase increased" },
  { category: "Hepatic", term: "Blood bilirubin increased" },
  { category: "Hepatic", term: "Hepatic failure" },
  { category: "GI", term: "Nausea" },
  { category: "GI", term: "Vomiting" },
  { category: "GI", term: "Diarrhea" },
  { category: "GI", term: "Constipation" },
  { category: "Constitutional", term: "Fatigue" },
  { category: "Constitutional", term: "Fever" },
  { category: "Constitutional", term: "Weight loss" },
  { category: "Constitutional", term: "Anorexia" },
];

const CATEGORIES = ["Hematologic", "Renal", "Hepatic", "GI", "Constitutional"];
const GRADES = [0, 1, 2, 3, 4, 5] as const;

export default function ToxicityAssessmentScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const [assessmentType, setAssessmentType] = useState<ToxicityAssessmentType>("baseline");
  const [cycleNumber, setCycleNumber] = useState("");
  const [search, setSearch] = useState("");
  const [grades, setGrades] = useState<Record<string, ToxicityEvent["grade"]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return COMMON_EVENTS;
    return COMMON_EVENTS.filter(
      ({ category, term }) =>
        category.toLowerCase().includes(query) || term.toLowerCase().includes(query)
    );
  }, [search]);

  const handleSave = async () => {
    setError(null);
    if (!profile?.institution_id) {
      setError("Your institution profile is unavailable. Sign in again and retry.");
      return;
    }

    let cycle: number | null = null;
    if (assessmentType === "follow_up") {
      cycle = Number(cycleNumber);
      if (!Number.isInteger(cycle) || cycle < 1) {
        setError("Enter a positive whole-number cycle for a follow-up assessment.");
        return;
      }
    }

    const events: ToxicityEvent[] = COMMON_EVENTS.flatMap(({ category, term }) => {
      const grade = grades[term];
      return grade === undefined ? [] : [{ category, term, grade }];
    });
    if (events.length === 0) {
      setError("Select a grade for at least one event before saving.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: assessment, error: assessmentError } = await supabase
        .from("toxicity_assessments")
        .insert({
          patient_id: patientId,
          institution_id: profile.institution_id,
          assessment_type: assessmentType,
          cycle_number: cycle,
          ctcae_version: "5.0",
          events,
          assessed_by: profile.id,
        })
        .select("id")
        .single();

      if (assessmentError) {
        setError(assessmentError.message);
        return;
      }

      await logAudit({
        userId: profile.id,
        institutionId: profile.institution_id,
        action: "create",
        tableName: "toxicity_assessments",
        recordId: assessment.id,
      });

      const severeEvents = events.filter((event) => event.grade >= 3);
      if (severeEvents.length > 0) {
        const eventSummary = severeEvents
          .map((event) => `${event.category}: ${event.term} (Grade ${event.grade})`)
          .join("; ");
        const { data: alert, error: alertError } = await supabase
          .from("toxicity_alerts")
          .insert({
            patient_id: patientId,
            institution_id: profile.institution_id,
            assessment_id: assessment.id,
            event_summary: eventSummary,
          })
          .select("id")
          .single();

        if (alertError) {
          setError(`Assessment saved, but the toxicity alert could not be created: ${alertError.message}`);
          return;
        }
        await logAudit({
          userId: profile.id,
          institutionId: profile.institution_id,
          action: "create",
          tableName: "toxicity_alerts",
          recordId: alert.id,
        });
      }

      navigation.navigate("ToxicityHistory", { patientId });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the toxicity assessment. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-clinical-bg"
    >
      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        <Text className="text-lg font-semibold text-clinical-primary mb-2">
          CTCAE v5.0 Toxicity Assessment
        </Text>
        <Text className="text-xs text-gray-500 mb-4">
          Record clinician-assessed events. This screen does not interpret or recommend care.
        </Text>

        <View className="flex-row mb-4">
          {(["baseline", "follow_up"] as const).map((type) => (
            <Pressable
              key={type}
              onPress={() => setAssessmentType(type)}
              accessibilityRole="radio"
              accessibilityState={{ selected: assessmentType === type }}
              className={`px-4 py-2 mr-2 rounded-lg border ${
                assessmentType === type
                  ? "bg-clinical-primary border-clinical-primary"
                  : "bg-clinical-card border-gray-300"
              }`}
            >
              <Text className={assessmentType === type ? "text-white" : "text-gray-700"}>
                {type === "baseline" ? "Baseline" : "Follow-up"}
              </Text>
            </Pressable>
          ))}
        </View>

        {assessmentType === "follow_up" ? (
          <>
            <Text className="text-xs font-medium text-gray-600 mb-1">Cycle Number</Text>
            <AppTextInput
              value={cycleNumber}
              onChangeText={setCycleNumber}
              keyboardType="number-pad"
              placeholder="e.g. 1"
              className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
            />
          </>
        ) : null}

        <AppTextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search categories and events"
          accessibilityLabel="Search CTCAE events"
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
        />

        {CATEGORIES.map((category) => {
          const categoryEvents = filteredEvents.filter((event) => event.category === category);
          if (categoryEvents.length === 0) return null;

          return (
            <View key={category} className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">{category}</Text>
              {categoryEvents.map(({ term }) => (
                <View key={term} className="bg-clinical-card rounded-lg border border-gray-100 p-3 mb-2">
                  <Text className="text-sm text-gray-800 mb-2">{term}</Text>
                  <View className="flex-row justify-between">
                    {GRADES.map((grade) => {
                      const selected = grades[term] === grade;
                      return (
                        <Pressable
                          key={grade}
                          onPress={() => setGrades((current) => ({ ...current, [term]: grade }))}
                          accessibilityRole="radio"
                          accessibilityLabel={`${term}, grade ${grade}`}
                          accessibilityState={{ selected }}
                          className={`w-9 h-9 rounded items-center justify-center border ${
                            selected
                              ? "bg-clinical-primary border-clinical-primary"
                              : "bg-white border-gray-300"
                          }`}
                        >
                          <Text className={selected ? "text-white text-xs font-semibold" : "text-gray-600 text-xs"}>
                            {grade}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          );
        })}

        {filteredEvents.length === 0 ? (
          <Text className="text-sm text-gray-500 text-center py-8">No matching CTCAE terms.</Text>
        ) : null}

        {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}

        <Pressable
          onPress={handleSave}
          disabled={submitting}
          className="bg-clinical-primary rounded-lg py-3 items-center mb-10"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-medium">Save Assessment</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}