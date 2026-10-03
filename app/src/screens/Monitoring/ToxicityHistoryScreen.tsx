import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { supabase } from "../../lib/supabase";
import type { ToxicityAssessment, ToxicityEvent } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "ToxicityHistory">;

const LABEL_WIDTH = 176;
const ASSESSMENT_WIDTH = 112;

export default function ToxicityHistoryScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const [assessments, setAssessments] = useState<ToxicityAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssessments = useCallback(async () => {
    setError(null);
    const { data, error: queryError } = await supabase
      .from("toxicity_assessments")
      .select("*")
      .eq("patient_id", patientId)
      .order("assessed_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
    } else {
      setAssessments((data ?? []) as ToxicityAssessment[]);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadAssessments);
    return unsubscribe;
  }, [navigation, loadAssessments]);

  const columns = useMemo(() => {
    const baseline = assessments
      .filter((assessment) => assessment.assessment_type === "baseline")
      .sort((a, b) => a.assessed_at.localeCompare(b.assessed_at));
    const followUps = assessments
      .filter((assessment) => assessment.assessment_type === "follow_up")
      .sort(
        (a, b) =>
          (a.cycle_number ?? 0) - (b.cycle_number ?? 0) ||
          a.assessed_at.localeCompare(b.assessed_at)
      );
    return [...baseline.slice(-1), ...followUps];
  }, [assessments]);

  const eventRows = useMemo(() => {
    const eventMap = new Map<string, ToxicityEvent>();
    for (const assessment of columns) {
      for (const event of assessment.events) {
        eventMap.set(`${event.category}:${event.term}`, event);
      }
    }
    return [...eventMap.values()].sort(
      (a, b) => a.category.localeCompare(b.category) || a.term.localeCompare(b.term)
    );
  }, [columns]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-clinical-bg px-4 pt-4">
      <Pressable
        onPress={() => navigation.navigate("ToxicityAssessment", { patientId })}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-4"
      >
        <Text className="text-white font-medium">+ New Assessment</Text>
      </Pressable>

      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}
      {columns.length === 0 ? (
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-gray-500 text-center">
            No toxicity assessments are recorded for this patient.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 20 }}>
          <Text className="text-sm font-semibold text-gray-700 mb-2">
            Baseline vs. Follow-up Timeline
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View className="flex-row border-b border-gray-300">
                <View style={{ width: LABEL_WIDTH }} className="justify-center py-3 pr-2">
                  <Text className="text-xs font-semibold text-gray-600">Event</Text>
                </View>
                {columns.map((assessment) => (
                  <View
                    key={assessment.id}
                    style={{ width: ASSESSMENT_WIDTH }}
                    className="px-2 py-2 border-l border-gray-200"
                  >
                    <Text className="text-xs font-semibold text-clinical-primary">
                      {assessment.assessment_type === "baseline"
                        ? "Baseline"
                        : `Follow-up C${assessment.cycle_number}`}
                    </Text>
                    <Text className="text-[10px] text-gray-400 mt-1">
                      {new Date(assessment.assessed_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>

              {eventRows.map((event) => (
                <View key={`${event.category}:${event.term}`} className="flex-row border-b border-gray-100">
                  <View style={{ width: LABEL_WIDTH }} className="justify-center py-3 pr-2">
                    <Text className="text-[10px] text-gray-400">{event.category}</Text>
                    <Text className="text-xs text-gray-700 mt-0.5">{event.term}</Text>
                  </View>
                  {columns.map((assessment) => {
                    const recorded = assessment.events.find(
                      (item) => item.category === event.category && item.term === event.term
                    );
                    return (
                      <View
                        key={assessment.id}
                        style={{ width: ASSESSMENT_WIDTH }}
                        className="justify-center items-center px-2 py-3 border-l border-gray-100"
                      >
                        <Text
                          className={`text-sm font-medium ${
                            recorded && recorded.grade >= 3
                              ? "text-clinical-danger"
                              : "text-gray-700"
                          }`}
                        >
                          {recorded ? `Grade ${recorded.grade}` : "—"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}