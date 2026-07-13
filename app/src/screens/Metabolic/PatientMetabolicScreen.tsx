import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../../lib/supabase";
import { ZONE_COLORS, ZONE_LABELS } from "../../lib/ketosis";
import type { MetabolicLog } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "PatientMetabolic">;

const screenWidth = Dimensions.get("window").width - 40;

const chartConfig = {
  backgroundGradientFrom: "#FFFFFF",
  backgroundGradientTo: "#FFFFFF",
  color: (opacity = 1) => `rgba(30, 58, 95, ${opacity})`,
  labelColor: () => "#6B7280",
  decimalPlaces: 1,
  propsForDots: { r: "4" },
};

export default function PatientMetabolicScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const [logs, setLogs] = useState<MetabolicLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from("metabolic_logs")
      .select("*")
      .eq("patient_id", patientId)
      .order("logged_at", { ascending: true });

    if (!error && data) setLogs(data as MetabolicLog[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadLogs);
    return unsubscribe;
  }, [navigation, loadLogs]);

  const recent = logs.slice(-7); // last 7 readings for the trend chart
  const chartLabels = recent.map((l) =>
    new Date(l.logged_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  );
  const glucoseData = recent.map((l) => l.glucose_mmol_l ?? 0);
  const ketonesData = recent.map((l) => l.ketones_mmol_l ?? 0);
  const hasChartData = recent.length >= 2;

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const rows = logs
        .slice()
        .reverse()
        .map(
          (l) => `
          <tr>
            <td>${new Date(l.logged_at).toLocaleString()}</td>
            <td>${l.glucose_mmol_l ?? "—"}</td>
            <td>${l.ketones_mmol_l ?? "—"}</td>
            <td>${l.ketosis_zone ? ZONE_LABELS[l.ketosis_zone] : "—"}</td>
          </tr>`
        )
        .join("");

      const html = `
        <html>
          <head><meta charset="utf-8" /></head>
          <body style="font-family: -apple-system, sans-serif; padding: 24px;">
            <h2 style="color:#1E3A5F;">Metabolic Reading History</h2>
            <p style="color:#6B7280; font-size:12px;">
              Descriptive tracking data only — not a clinical diagnostic report.
            </p>
            <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
              <thead>
                <tr style="background:#F7F9FA; text-align:left;">
                  <th style="padding:8px; border-bottom:1px solid #E5E7EB;">Date</th>
                  <th style="padding:8px; border-bottom:1px solid #E5E7EB;">Glucose (mmol/L)</th>
                  <th style="padding:8px; border-bottom:1px solid #E5E7EB;">Ketones (mmol/L)</th>
                  <th style="padding:8px; border-bottom:1px solid #E5E7EB;">Zone</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      }
    } catch (e) {
      // Non-critical — export failing shouldn't block the rest of the screen
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
    <ScrollView className="flex-1 bg-clinical-bg px-4 pt-4">
      <Pressable
        onPress={() => navigation.navigate("NewMetabolicLog", { patientId })}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-3"
      >
        <Text className="text-white font-medium">+ Log Reading</Text>
      </Pressable>

      <Pressable
        onPress={handleExportPdf}
        disabled={exporting || logs.length === 0}
        className="border border-clinical-primary rounded-lg py-3 items-center mb-5"
      >
        {exporting ? (
          <ActivityIndicator color="#1E3A5F" />
        ) : (
          <Text className="text-clinical-primary font-medium">Export PDF</Text>
        )}
      </Pressable>

      {hasChartData ? (
        <>
          <Text className="text-sm font-medium text-gray-600 mb-2">Glucose Trend</Text>
          <LineChart
            data={{ labels: chartLabels, datasets: [{ data: glucoseData }] }}
            width={screenWidth}
            height={160}
            chartConfig={chartConfig}
            bezier
            style={{ borderRadius: 12, marginBottom: 20 }}
          />

          <Text className="text-sm font-medium text-gray-600 mb-2">Ketones Trend</Text>
          <LineChart
            data={{ labels: chartLabels, datasets: [{ data: ketonesData }] }}
            width={screenWidth}
            height={160}
            chartConfig={chartConfig}
            bezier
            style={{ borderRadius: 12, marginBottom: 20 }}
          />
        </>
      ) : (
        <Text className="text-gray-400 text-center mb-5">
          Log at least 2 readings to see trend charts.
        </Text>
      )}

      <Text className="text-sm font-medium text-gray-600 mb-2">History</Text>
      {logs.length === 0 ? (
        <Text className="text-gray-400 text-center mt-4 mb-10">No readings logged yet.</Text>
      ) : (
        logs
          .slice()
          .reverse()
          .map((log) => (
            <View
              key={log.id}
              className="bg-clinical-card rounded-xl p-4 mb-3 border border-gray-100 flex-row justify-between items-center"
            >
              <View>
                <Text className="text-sm text-gray-800">
                  {new Date(log.logged_at).toLocaleDateString()}
                </Text>
                <Text className="text-xs text-gray-500 mt-1">
                  Glucose: {log.glucose_mmol_l ?? "—"} · Ketones: {log.ketones_mmol_l ?? "—"}
                </Text>
              </View>
              {log.ketosis_zone ? (
                <View
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: ZONE_COLORS[log.ketosis_zone] + "20" }}
                >
                  <Text
                    style={{ color: ZONE_COLORS[log.ketosis_zone] }}
                    className="text-xs font-medium"
                  >
                    {ZONE_LABELS[log.ketosis_zone]}
                  </Text>
                </View>
              ) : null}
            </View>
          ))
      )}
      <View className="h-10" />
    </ScrollView>
  );
}