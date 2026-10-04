import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../../lib/supabase";
import { ZONE_COLORS, ZONE_LABELS } from "../../lib/ketosis";
import type { DosimetryRecord, LabReferenceRange, LabType, MetabolicLog } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "PatientMetabolic">;

const screenWidth = Dimensions.get("window").width - 40;
const BAND_CHART_WIDTH = Dimensions.get("window").width - 32;
const BAND_CHART_HEIGHT = 220;

const LABS: { key: LabType; title: string }[] = [
  { key: "platelets", title: "Platelets" },
  { key: "hemoglobin", title: "Hemoglobin" },
  { key: "creatinine", title: "Creatinine" },
  { key: "egfr", title: "eGFR" },
  { key: "wbc", title: "WBC" },
];

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
  const [referenceRanges, setReferenceRanges] = useState<LabReferenceRange[]>([]);
  const [cumulativeDose, setCumulativeDose] = useState<{ cycle: number; dose: number }[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadLogs = useCallback(async () => {
    const [logsResult, rangesResult, dosimetryResult] = await Promise.all([
      supabase
        .from("metabolic_logs")
        .select("*")
        .eq("patient_id", patientId)
        .order("logged_at", { ascending: true }),
      supabase.from("lab_reference_ranges").select("*"),
      supabase
        .from("dosimetry_records")
        .select("cycle_number, organ_doses")
        .eq("patient_id", patientId)
        .order("cycle_number", { ascending: true }),
    ]);

    if (!logsResult.error && logsResult.data) setLogs(logsResult.data as MetabolicLog[]);
    if (rangesResult.error) setDataError(rangesResult.error.message);
    else setReferenceRanges((rangesResult.data ?? []) as LabReferenceRange[]);

    if (!dosimetryResult.error && dosimetryResult.data) {
      const cycleTotals = new Map<number, number>();
      for (const record of dosimetryResult.data as Pick<DosimetryRecord, "cycle_number" | "organ_doses">[]) {
        const marrowDose = record.organ_doses
          .filter((organDose) => organDose.organ.toLowerCase().includes("bone marrow"))
          .reduce((total, organDose) => total + organDose.dose_gy, 0);
        cycleTotals.set(record.cycle_number, (cycleTotals.get(record.cycle_number) ?? 0) + marrowDose);
      }
      let runningTotal = 0;
      setCumulativeDose(
        [...cycleTotals.entries()]
          .sort(([cycleA], [cycleB]) => cycleA - cycleB)
          .map(([cycle, dose]) => {
            runningTotal += dose;
            return { cycle, dose: runningTotal };
          })
      );
    }
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
  const rangeByType = new Map(referenceRanges.map((range) => [range.lab_type, range]));

  const cumulativeLabels = cumulativeDose.map((item) => `C${item.cycle}`);
  const cumulativeValues = cumulativeDose.map((item) => item.dose);

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
            <td>${l.platelets ?? "—"}</td>
            <td>${l.hemoglobin ?? "—"}</td>
            <td>${l.creatinine ?? "—"}</td>
            <td>${l.egfr ?? "—"}</td>
            <td>${l.wbc ?? "—"}</td>
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
                  <th style="padding:8px; border-bottom:1px solid #E5E7EB;">Platelets</th>
                  <th style="padding:8px; border-bottom:1px solid #E5E7EB;">Hemoglobin</th>
                  <th style="padding:8px; border-bottom:1px solid #E5E7EB;">Creatinine</th>
                  <th style="padding:8px; border-bottom:1px solid #E5E7EB;">eGFR</th>
                  <th style="padding:8px; border-bottom:1px solid #E5E7EB;">WBC</th>
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

      <View className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <Text className="text-xs text-amber-900">
          Reference bands are generic adult examples, not individualized grading. Verify them against
          institutional ranges and interpret values clinically.
        </Text>
      </View>
      {dataError ? <Text className="text-clinical-danger text-xs mb-3">{dataError}</Text> : null}

      <Text className="text-sm font-medium text-gray-700 mb-2">Laboratory trends</Text>
      {LABS.map(({ key, title }) => {
        const reference = rangeByType.get(key);
        if (!reference) return null;
        const values = logs
          .filter((log) => log[key] !== null)
          .map((log) => ({ date: log.logged_at, value: log[key] as number }));
        if (values.length === 0) return null;
        const first = values[0].value;
        const latest = values[values.length - 1].value;
        const delta = first === 0 ? null : ((latest - first) / Math.abs(first)) * 100;

        return (
          <View key={key} className="bg-clinical-card rounded-lg border border-gray-100 p-3 mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-semibold text-gray-800">{title}</Text>
              <Text className="text-xs text-gray-500">{reference.unit}</Text>
            </View>
            <View className="flex-row justify-between items-center bg-gray-50 rounded-md px-3 py-2 mb-2">
              <Text className="text-xs text-gray-600">Δ from baseline</Text>
              <Text className="text-sm font-semibold text-clinical-primary">
                {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`}
              </Text>
            </View>
            <LabTrendChart title={title} values={values.slice(-7)} reference={reference} />
            <View className="flex-row flex-wrap mt-2">
              <BandLegend color="#22c55e" label="Within range" />
              <BandLegend color="#eab308" label="Grade 1" />
              <BandLegend color="#f97316" label="Grade 2" />
              <BandLegend color="#ef4444" label="Grade 3+" />
            </View>
          </View>
        );
      })}

      <Text className="text-sm font-medium text-gray-700 mt-2 mb-2">
        Cumulative bone-marrow dose
      </Text>
      {cumulativeDose.length > 0 ? (
        <LineChart
          data={{ labels: cumulativeLabels, datasets: [{ data: cumulativeValues }] }}
          width={screenWidth}
          height={190}
          chartConfig={chartConfig}
          bezier
          yAxisSuffix=" Gy"
          style={{ borderRadius: 8, marginBottom: 20 }}
        />
      ) : (
        <Text className="text-xs text-gray-400 mb-5">
          No bone-marrow doses are recorded in dosimetry records.
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

function LabTrendChart({
  title,
  values,
  reference,
}: {
  title: string;
  values: { date: string; value: number }[];
  reference: LabReferenceRange;
}) {
  const [flaggedPoint, setFlaggedPoint] = useState<string | null>(null);
  const plot = { left: 48, right: BAND_CHART_WIDTH - 12, top: 14, bottom: BAND_CHART_HEIGHT - 30 };
  const candidates = [
    ...values.map((point) => point.value),
    reference.normal_low,
    reference.normal_high,
    reference.grade1_threshold,
    reference.grade2_threshold,
    reference.grade3_threshold,
  ];
  const minValue = Math.min(...candidates);
  const maxValue = Math.max(...candidates);
  const padding = Math.max((maxValue - minValue) * 0.08, Math.abs(maxValue || 1) * 0.02);
  const domainMin = minValue - padding;
  const domainMax = maxValue + padding;
  const x = (index: number) =>
    plot.left + (values.length < 2 ? (plot.right - plot.left) / 2 : (index / (values.length - 1)) * (plot.right - plot.left));
  const y = (value: number) =>
    plot.bottom - ((value - domainMin) / (domainMax - domainMin)) * (plot.bottom - plot.top);
  const getBands = () => {
    if (reference.abnormal_direction === "low") {
      return [
        { low: domainMin, high: reference.grade3_threshold, color: "#ef4444" },
        { low: reference.grade3_threshold, high: reference.grade2_threshold, color: "#f97316" },
        { low: reference.grade2_threshold, high: reference.grade1_threshold, color: "#eab308" },
        { low: reference.grade1_threshold, high: reference.normal_high, color: "#22c55e" },
      ];
    }
    return [
      { low: reference.normal_low, high: reference.normal_high, color: "#22c55e" },
      { low: reference.normal_high, high: reference.grade2_threshold, color: "#eab308" },
      { low: reference.grade2_threshold, high: reference.grade3_threshold, color: "#f97316" },
      { low: reference.grade3_threshold, high: domainMax, color: "#ef4444" },
    ];
  };
  const linePoints = values.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const yLabels = [domainMax, (domainMax + domainMin) / 2, domainMin];

  return (
    <View>
      <Svg width={BAND_CHART_WIDTH} height={BAND_CHART_HEIGHT}>
        {getBands().map((band, index) => {
          const low = Math.max(domainMin, Math.min(domainMax, band.low));
          const high = Math.max(domainMin, Math.min(domainMax, band.high));
          if (high <= low) return null;
          const bandY = y(high);
          return (
            <Rect
              key={index}
              x={plot.left}
              y={bandY}
              width={plot.right - plot.left}
              height={y(low) - bandY}
              fill={band.color}
              opacity={0.18}
            />
          );
        })}
        {yLabels.map((value, index) => (
          <React.Fragment key={index}>
            <Line x1={plot.left} y1={y(value)} x2={plot.right} y2={y(value)} stroke="#d1d5db" strokeWidth={1} />
            <SvgText x={plot.left - 5} y={y(value) + 3} textAnchor="end" fontSize={9} fill="#6b7280">
              {value.toPrecision(3)}
            </SvgText>
          </React.Fragment>
        ))}
        {values.length > 1 ? (
          <Polyline points={linePoints} fill="none" stroke="#1e3a5f" strokeWidth={2.5} />
        ) : null}
        {values.map((point, index) => {
          const isGrade2Plus =
            reference.abnormal_direction === "low"
              ? point.value < reference.grade2_threshold
              : point.value > reference.grade2_threshold;
          const key = `${title}-${point.date}`;
          return (
            <React.Fragment key={key}>
              <Circle
                cx={x(index)}
                cy={y(point.value)}
                r={isGrade2Plus ? 5 : 3.5}
                fill={isGrade2Plus ? "#b91c1c" : "#1e3a5f"}
                onPress={
                  isGrade2Plus
                    ? () => setFlaggedPoint(flaggedPoint === key ? null : key)
                    : undefined
                }
              />
              {isGrade2Plus ? (
                <SvgText
                  x={x(index) + 6}
                  y={y(point.value) - 6}
                  fontSize={12}
                  fontWeight="bold"
                  fill="#b91c1c"
                  onPress={() => setFlaggedPoint(flaggedPoint === key ? null : key)}
                >
                  !
                </SvgText>
              ) : null}
              {(values.length <= 4 || index === 0 || index === values.length - 1) ? (
                <SvgText x={x(index)} y={plot.bottom + 17} textAnchor="middle" fontSize={8} fill="#6b7280">
                  {new Date(point.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </SvgText>
              ) : null}
            </React.Fragment>
          );
        })}
      </Svg>
      {flaggedPoint ? (
        (() => {
          const index = values.findIndex((point) => `${title}-${point.date}` === flaggedPoint);
          const point = values[index];
          const threshold = reference.grade2_threshold;
          const comparator = reference.abnormal_direction === "low" ? "<" : ">";
          return point ? (
            <View className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-1">
              <Text className="text-xs text-red-800">
                {new Date(point.date).toLocaleDateString()}: {point.value} {reference.unit} crossed the Grade 2 threshold ({comparator} {threshold} {reference.unit}).
              </Text>
            </View>
          ) : null;
        })()
      ) : null}
    </View>
  );
}

function BandLegend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center mr-3 mb-1">
      <View style={{ width: 8, height: 8, backgroundColor: color }} className="rounded-sm mr-1" />
      <Text className="text-[10px] text-gray-500">{label}</Text>
    </View>
  );
}