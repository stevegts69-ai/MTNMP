import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { supabase } from "../../lib/supabase";
import { calculateNextCycleDueDate } from "../../lib/cycleSchedule";
import type { TreatmentLog } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "CycleSchedule">;

interface TreatmentScheduleRow extends TreatmentLog {
  patients: { full_name: string; mrn: string } | null;
  next_cycle_due_date: string;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function getMonthDays(month: Date): (string | null)[][] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: dayCount }, (_, index) =>
      `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

export default function CycleScheduleScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [rows, setRows] = useState<TreatmentScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    setError(null);
    const { data, error: queryError } = await supabase
      .from("treatment_logs")
      .select("*, patients(full_name, mrn)")
      .not("administered_date", "is", null)
      .not("cycle_number", "is", null)
      .not("cycle_interval_days", "is", null)
      .order("administered_date", { ascending: true });

    if (queryError) {
      setError(queryError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const scheduled = (data ?? [])
      .map((item) => {
        const treatment = item as unknown as TreatmentLog & {
          patients: { full_name: string; mrn: string } | null;
        };
        const nextDate = calculateNextCycleDueDate(
          treatment.administered_date,
          treatment.cycle_interval_days
        );
        const hasMoreCycles =
          treatment.total_planned_cycles === null ||
          treatment.total_planned_cycles === undefined ||
          treatment.cycle_number! < treatment.total_planned_cycles;
        return nextDate && hasMoreCycles
          ? ({ ...treatment, next_cycle_due_date: nextDate } as TreatmentScheduleRow)
          : null;
      })
      .filter((item): item is TreatmentScheduleRow => item !== null);
    setRows(scheduled);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadSchedule);
    return unsubscribe;
  }, [navigation, loadSchedule]);

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const monthRows = useMemo(
    () => rows.filter((row) => row.next_cycle_due_date.startsWith(monthKey)),
    [rows, monthKey]
  );
  const rowsByDate = useMemo(() => {
    const grouped = new Map<string, TreatmentScheduleRow[]>();
    for (const row of monthRows) {
      const sameDate = grouped.get(row.next_cycle_due_date) ?? [];
      sameDate.push(row);
      grouped.set(row.next_cycle_due_date, sameDate);
    }
    return [...grouped.entries()].sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
  }, [monthRows]);
  const calendarWeeks = getMonthDays(month);
  const scheduledDates = new Set(monthRows.map((row) => row.next_cycle_due_date));
  const cellWidth = (width - 32) / 7;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-4 pt-4">
      <View className="flex-row justify-between items-center mb-4">
        <Pressable
          onPress={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          className="w-10 h-10 items-center justify-center rounded-md border border-gray-300 bg-clinical-card"
        >
          <Text className="text-lg text-clinical-primary">‹</Text>
        </Pressable>
        <Text className="text-base font-semibold text-clinical-primary">
          {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </Text>
        <Pressable
          onPress={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          className="w-10 h-10 items-center justify-center rounded-md border border-gray-300 bg-clinical-card"
        >
          <Text className="text-lg text-clinical-primary">›</Text>
        </Pressable>
      </View>

      <View className="bg-clinical-card rounded-lg border border-gray-100 p-2 mb-5">
        <View className="flex-row">
          {WEEKDAYS.map((day, index) => (
            <View key={`${day}-${index}`} style={{ width: cellWidth }} className="items-center py-2">
              <Text className="text-xs font-semibold text-gray-500">{day}</Text>
            </View>
          ))}
        </View>
        {calendarWeeks.map((week, weekIndex) => (
          <View key={weekIndex} className="flex-row">
            {week.map((date, dayIndex) => (
              <View
                key={date ?? `empty-${weekIndex}-${dayIndex}`}
                style={{ width: cellWidth, height: 44 }}
                className={`items-center justify-center ${date && scheduledDates.has(date) ? "bg-teal-50" : ""}`}
              >
                {date ? (
                  <>
                    <Text className={`text-xs ${scheduledDates.has(date) ? "font-bold text-clinical-primary" : "text-gray-700"}`}>
                      {Number(date.slice(-2))}
                    </Text>
                    {scheduledDates.has(date) ? <View className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1" /> : null}
                  </>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>

      <Text className="text-sm font-semibold text-gray-700 mb-2">Scheduled next cycles</Text>
      {error ? <Text className="text-sm text-clinical-danger mb-3">{error}</Text> : null}
      {rowsByDate.length === 0 ? (
        <Text className="text-sm text-gray-400 text-center py-8">
          No next-cycle dates are scheduled for this month.
        </Text>
      ) : (
        rowsByDate.map(([date, items]) => (
          <View key={date} className="mb-4">
            <Text className="text-xs font-semibold text-teal-800 mb-2">{date}</Text>
            {items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => navigation.navigate("PatientTreatment", { patientId: item.patient_id })}
                className="bg-clinical-card border border-gray-100 rounded-lg p-3 mb-2"
              >
                <View className="flex-row justify-between items-start">
                  <Text className="text-sm font-medium text-gray-800 flex-1">
                    {item.patients?.full_name ?? "Patient"}
                  </Text>
                  <Text className="text-xs text-clinical-primary">
                    Cycle {(item.cycle_number ?? 0) + 1}
                  </Text>
                </View>
                <Text className="text-xs text-gray-500 mt-1">
                  {item.isotope} · MRN {item.patients?.mrn ?? "—"}
                </Text>
              </Pressable>
            ))}
          </View>
        ))
      )}
      <View className="h-8" />
    </ScrollView>
  );
}