import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import { encode } from "base64-arraybuffer";
import { logAudit } from "../../lib/audit";
import { percentChangeFromFirst, summarizeRecist } from "../../lib/responseAssessment";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type {
  DosimetryRecord,
  LesionMeasurement,
  MetabolicLog,
  Patient,
  ToxicityAssessment,
  TreatmentLog,
} from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "TumorBoardReport">;

interface InstitutionBrand {
  name: string;
  logo_url: string | null;
}

const CHART_WIDTH = Dimensions.get("window").width - 48;
const CHART_CONFIG = {
  backgroundGradientFrom: "#FFFFFF",
  backgroundGradientTo: "#FFFFFF",
  color: (opacity = 1) => `rgba(30, 58, 95, ${opacity})`,
  labelColor: () => "#6B7280",
  decimalPlaces: 1,
  propsForDots: { r: "3" },
};

function escapeHtml(value: unknown): string {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function tableRows(rows: [string, unknown][]): string {
  return rows
    .map(
      ([label, value]) =>
        `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
    )
    .join("");
}

async function fetchLogoDataUri(logoUrl: string | null): Promise<string | null> {
  if (!logoUrl || !logoUrl.startsWith("https://")) return null;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/png";
    const imageBase64 = encode(await response.arrayBuffer());
    return `data:${contentType};base64,${imageBase64}`;
  } catch {
    return null;
  }
}

export default function TumorBoardReportScreen({ route }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((state) => state.profile);
  const glucoseChartRef = useRef<ViewShot>(null);
  const ketonesChartRef = useRef<ViewShot>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [institution, setInstitution] = useState<InstitutionBrand | null>(null);
  const [institutionLogo, setInstitutionLogo] = useState<string | null>(null);
  const [treatments, setTreatments] = useState<TreatmentLog[]>([]);
  const [latestDosimetry, setLatestDosimetry] = useState<DosimetryRecord | null>(null);
  const [toxicityAssessments, setToxicityAssessments] = useState<ToxicityAssessment[]>([]);
  const [lesionMeasurements, setLesionMeasurements] = useState<LesionMeasurement[]>([]);
  const [labs, setLabs] = useState<MetabolicLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReportData = useCallback(async () => {
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

    const [institutionResult, treatmentResult, dosimetryResult, toxicityResult, labResult, lesionResult] =
      await Promise.all([
        supabase
          .from("institutions")
          .select("name, logo_url")
          .eq("id", currentPatient.institution_id)
          .maybeSingle(),
        supabase
          .from("treatment_logs")
          .select("*")
          .eq("patient_id", patientId)
          .order("administered_date", { ascending: false }),
        supabase
          .from("dosimetry_records")
          .select("*")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("toxicity_assessments")
          .select("*")
          .eq("patient_id", patientId),
        supabase
          .from("metabolic_logs")
          .select("*")
          .eq("patient_id", patientId)
          .order("logged_at", { ascending: true }),
        supabase
          .from("lesion_measurements")
          .select("*")
          .eq("patient_id", patientId)
          .order("timepoint_date", { ascending: true }),
      ]);

    if (institutionResult.data) {
      const brand = institutionResult.data as InstitutionBrand;
      setInstitution(brand);
      setInstitutionLogo(await fetchLogoDataUri(brand.logo_url));
    }
    setTreatments((treatmentResult.data ?? []) as TreatmentLog[]);
    setLatestDosimetry((dosimetryResult.data as DosimetryRecord | null) ?? null);
    setToxicityAssessments((toxicityResult.data ?? []) as ToxicityAssessment[]);
    setLabs((labResult.data ?? []) as MetabolicLog[]);
    setLesionMeasurements((lesionResult.data ?? []) as LesionMeasurement[]);
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const recentLabs = labs.slice(-7);
  const chartLabels = recentLabs.map((log) =>
    new Date(log.logged_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  );
  const glucoseData = recentLabs.map((log) => log.glucose_mmol_l ?? 0);
  const ketoneData = recentLabs.map((log) => log.ketones_mmol_l ?? 0);
  const hasLabTrends = recentLabs.length >= 2;

  const worstGrades = new Map<string, number>();
  for (const assessment of toxicityAssessments) {
    for (const event of assessment.events) {
      worstGrades.set(event.category, Math.max(worstGrades.get(event.category) ?? 0, event.grade));
    }
  }

  const handleExport = async () => {
    if (!patient || !profile) {
      setError("Patient or signed-in profile information is unavailable.");
      return;
    }

    setExporting(true);
    setError(null);
    try {
      let glucoseImage: string | null = null;
      let ketoneImage: string | null = null;
      if (hasLabTrends) {
        [glucoseImage, ketoneImage] = await Promise.all([
          glucoseChartRef.current?.capture?.() ?? Promise.resolve(null),
          ketonesChartRef.current?.capture?.() ?? Promise.resolve(null),
        ]);
      }

      const treatmentCycles = treatments.length;
      const isotopes = [...new Set(treatments.map((item) => item.isotope))].join(", ") || "—";
      const protocols = [
        ...new Set(
          treatments
            .map((item) => item.target_receptor_or_tissue?.trim())
            .filter((value): value is string => Boolean(value))
        ),
      ].join(", ") || "—";

      const dosimetryHtml = latestDosimetry
        ? `
          <p>Cycle ${escapeHtml(latestDosimetry.cycle_number)} · ${escapeHtml(latestDosimetry.isotope)} · ${escapeHtml(latestDosimetry.calculation_method)}</p>
          <h4>Organ doses</h4>
          <table><thead><tr><th>Organ</th><th>Dose (Gy)</th><th>Entered tolerance (Gy)</th></tr></thead><tbody>
            ${latestDosimetry.organ_doses
              .map((dose) => `<tr><td>${escapeHtml(dose.organ)}</td><td>${escapeHtml(dose.dose_gy)}</td><td>${escapeHtml(dose.tolerance_limit_gy ?? "—")}</td></tr>`)
              .join("") || '<tr><td colspan="3">No organ doses recorded.</td></tr>'}
          </tbody></table>
          <h4>Tumor doses</h4>
          <table><thead><tr><th>Lesion</th><th>Dose (Gy)</th><th>Volume (cc)</th></tr></thead><tbody>
            ${latestDosimetry.tumor_doses
              .map((dose) => `<tr><td>${escapeHtml(dose.lesion_label)}</td><td>${escapeHtml(dose.dose_gy)}</td><td>${escapeHtml(dose.volume_cc ?? "—")}</td></tr>`)
              .join("") || '<tr><td colspan="3">No tumor doses recorded.</td></tr>'}
          </tbody></table>
          <p>Imaging timepoints: ${escapeHtml(
            latestDosimetry.imaging_timepoints
              .map((point) => `${point.label} (${point.hours_post_injection} h)`)
              .join(", ") || "—"
          )}</p>
          <p>Notes: ${escapeHtml(latestDosimetry.notes ?? "—")}</p>`
        : "<p>Not yet recorded.</p>";

      const toxicityHtml = [...worstGrades.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([category, grade]) => `<tr><td>${escapeHtml(category)}</td><td>Grade ${grade}</td></tr>`)
        .join("");

      const recistResults = summarizeRecist(lesionMeasurements);
      const recistHtml = recistResults.length
        ? `<h4>RECIST 1.1 computed categories</h4><table><thead><tr><th>Timepoint</th><th>Target sum (mm)</th><th>Change from baseline</th><th>Category</th></tr></thead><tbody>${recistResults
            .map(
              (result) => `<tr${result.hasNewLesion ? ' style="background:#fee2e2;color:#991b1b;font-weight:bold;"' : ""}><td>${escapeHtml(result.date)}${result.hasNewLesion ? " · NEW LESION" : ""}</td><td>${result.targetLesionSum.toFixed(1)}</td><td>${escapeHtml(formatChange(result.percentChangeFromBaseline))}</td><td>${result.category}</td></tr>`
            )
            .join("")}</tbody></table><p class="muted">Categories are computed from recorded target-lesion sums, baseline, nadir, and new-lesion flags. Verify the raw measurements.</p>`
        : "<p>No RECIST 1.1 measurements recorded.</p>";

      const percistGroups = new Map<string, LesionMeasurement[]>();
      for (const record of lesionMeasurements.filter((item) => item.method === "PERCIST")) {
        const group = percistGroups.get(record.lesion_label) ?? [];
        group.push(record);
        percistGroups.set(record.lesion_label, group);
      }
      const percistHtml = [...percistGroups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([lesion, records]) => {
          const sorted = records.slice().sort((a, b) => a.timepoint_date.localeCompare(b.timepoint_date));
          const values = sorted.map((record) => record.suv_max ?? 0);
          const trend = sorted.length > 1
            ? `SUVmax: ${sorted[0].suv_max} → ${sorted[sorted.length - 1].suv_max}, ${formatChange(percentChangeFromFirst(values))}`
            : `SUVmax: ${sorted[0]?.suv_max ?? "—"}`;
          return `<h4>${escapeHtml(lesion)} · value trend only</h4><p>${escapeHtml(trend)}</p><table><thead><tr><th>Date</th><th>SUVmax</th><th>Physician-entered PERCIST</th><th>New lesion</th></tr></thead><tbody>${sorted
            .map((record) => `<tr${record.is_new_lesion ? ' style="background:#fee2e2;color:#991b1b;font-weight:bold;"' : ""}><td>${escapeHtml(record.timepoint_date)}${record.is_new_lesion ? " · NEW LESION" : ""}</td><td>${escapeHtml(record.suv_max)}</td><td>${escapeHtml(record.manual_percist_category ?? "—")}</td><td>${record.is_new_lesion ? "Yes" : "No"}</td></tr>`)
            .join("")}</tbody></table>`;
        })
        .join("");

      const logoMarkup = institutionLogo
        ? `<img class="logo" src="${escapeHtml(institutionLogo)}" alt="Institution logo" />`
        : `<div class="monogram">${escapeHtml((institution?.name ?? "M").slice(0, 1).toUpperCase())}</div>`;
      const html = `
        <!doctype html>
        <html><head><meta charset="utf-8" />
          <style>
            @page { margin: 22mm 16mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #24323a; font-size: 10pt; }
            header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1e3a5f; padding-bottom: 14px; margin-bottom: 20px; }
            .logo, .monogram { width: 52px; height: 52px; object-fit: contain; }
            .monogram { display: flex; align-items: center; justify-content: center; color: #fff; background: #1e3a5f; font-size: 24pt; font-weight: 700; }
            h1 { margin: 0; color: #1e3a5f; font-size: 19pt; }
            header p { margin: 4px 0 0; color: #697780; }
            h2 { margin: 22px 0 8px; color: #1e3a5f; font-size: 13pt; border-bottom: 1px solid #d5dfe3; padding-bottom: 5px; }
            h4 { margin: 14px 0 6px; color: #38515e; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
            th, td { text-align: left; border-bottom: 1px solid #e5eaec; padding: 7px 8px; vertical-align: top; }
            th { width: 30%; color: #52636b; background: #f5f8f9; }
            thead th { width: auto; }
            .chart { display: block; width: 100%; max-height: 290px; object-fit: contain; margin: 12px auto; }
            .muted { color: #6b7780; font-size: 9pt; }
            .notice { background: #f5f8f9; border-left: 3px solid #1e3a5f; padding: 10px 12px; }
          </style>
        </head><body>
          <header>${logoMarkup}<div><h1>Tumor Board Report</h1><p>${escapeHtml(institution?.name ?? "Institution")}</p></div></header>
          <p class="muted">Generated ${escapeHtml(new Date().toLocaleString())} · Clinical record summary</p>
          <h2>Patient Demographics</h2>
          <table>${tableRows([
            ["Patient", patient.full_name],
            ["Medical record number", patient.mrn],
            ["Date of birth", formatDate(patient.date_of_birth)],
            ["Sex", patient.sex ?? "—"],
            ["Cancer type", patient.cancer_type ?? "—"],
            ["Cancer stage", patient.cancer_stage ?? "—"],
          ])}</table>
          <h2>Protocol and Treatment Cycles</h2>
          <table>${tableRows([
            ["Protocol / target", protocols],
            ["Isotope(s)", isotopes],
            ["Cycles completed (treatment records)", treatmentCycles],
          ])}</table>
          <h2>Latest Dosimetry</h2>${dosimetryHtml}
          <h2>Toxicity Summary</h2>
          <table><thead><tr><th>CTCAE category</th><th>Worst recorded grade</th></tr></thead><tbody>
            ${toxicityHtml || '<tr><td colspan="2">Not yet assessed.</td></tr>'}
          </tbody></table>
          <h2>Metabolic Lab Trends</h2>
          ${
            glucoseImage && ketoneImage
              ? `<h4>Glucose (mmol/L)</h4><img class="chart" src="${escapeHtml(glucoseImage)}" /><h4>Ketones (mmol/L)</h4><img class="chart" src="${escapeHtml(ketoneImage)}" />`
              : '<p class="muted">Trend charts are unavailable; at least two readings are needed.</p>'
          }
          <h2>Response Assessment</h2>
          ${recistHtml}
          <h4>PERCIST SUVmax trends</h4>
          <p class="muted">Value trends only; SUVmax does not automatically determine a formal PERCIST classification. Any displayed category is physician-entered.</p>
          ${percistHtml || "<p>No PERCIST SUVmax measurements recorded.</p>"}
          <p class="muted">This report assembles recorded data for discussion. It does not provide diagnosis, treatment recommendations, or an automated clinical assessment.</p>
        </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      await logAudit({
        userId: profile.id,
        institutionId: profile.institution_id,
        action: "export",
        tableName: "tumor_board_reports",
        recordId: patient.id,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      } else {
        Alert.alert("Report ready", "The PDF was generated, but sharing is unavailable on this device.");
      }
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Unable to generate the tumor board report. Please try again."
      );
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

  if (error && !patient) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg px-6">
        <Text className="text-clinical-danger text-center">{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-4 pt-4">
      <Text className="text-lg font-semibold text-clinical-primary mb-1">Tumor Board Report</Text>
      <Text className="text-xs text-gray-500 mb-4">
        {patient?.full_name} · {patient?.mrn}
      </Text>
      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}
      <Pressable
        onPress={handleExport}
        disabled={exporting}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-4"
      >
        {exporting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-medium">Generate and Share PDF</Text>
        )}
      </Pressable>

      <Text className="text-sm font-semibold text-gray-700 mb-2">Glucose trend</Text>
      {hasLabTrends ? (
        <ViewShot
          ref={glucoseChartRef}
          options={{ format: "png", quality: 1, result: "data-uri" }}
          style={{ backgroundColor: "#fff", alignSelf: "center" }}
        >
          <LineChart
            data={{ labels: chartLabels, datasets: [{ data: glucoseData }] }}
            width={CHART_WIDTH}
            height={176}
            chartConfig={CHART_CONFIG}
            bezier
            style={{ borderRadius: 8 }}
          />
        </ViewShot>
      ) : (
        <Text className="text-xs text-gray-400 mb-3">At least two readings are needed for a trend.</Text>
      )}

      <Text className="text-sm font-semibold text-gray-700 mt-4 mb-2">Ketone trend</Text>
      {hasLabTrends ? (
        <ViewShot
          ref={ketonesChartRef}
          options={{ format: "png", quality: 1, result: "data-uri" }}
          style={{ backgroundColor: "#fff", alignSelf: "center" }}
        >
          <LineChart
            data={{ labels: chartLabels, datasets: [{ data: ketoneData }] }}
            width={CHART_WIDTH}
            height={176}
            chartConfig={CHART_CONFIG}
            bezier
            style={{ borderRadius: 8 }}
          />
        </ViewShot>
      ) : (
        <Text className="text-xs text-gray-400 mb-3">At least two readings are needed for a trend.</Text>
      )}

      <Text className="text-sm font-semibold text-gray-700 mt-4 mb-2">Response assessment</Text>
      <View className="border-l-4 border-clinical-primary bg-clinical-card p-3 mb-8">
        <Text className="text-sm text-gray-600">Not yet assessed</Text>
      </View>
    </ScrollView>
  );
}

function formatChange(change: number | null): string {
  if (change === null) return "—";
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return `${sign}${Math.abs(change).toFixed(1)}%`;
}