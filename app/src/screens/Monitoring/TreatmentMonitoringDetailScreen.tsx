import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import AppTextInput from "../../components/AppTextInput";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { logAudit } from "../../lib/audit";
import type { TreatmentLog, ImagingRecord } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MonitoringStackParamList } from "../../navigation/MonitoringStack";

type Props = NativeStackScreenProps<MonitoringStackParamList, "TreatmentMonitoringDetail">;

const SIGNED_URL_EXPIRY_SECONDS = 60 * 10;

interface MonitoringRow {
  id: string;
  pre_imaging_id: string | null;
  post_imaging_id: string | null;
  next_imaging_due_date: string | null;
  response_notes: string | null;
}

export default function TreatmentMonitoringDetailScreen({ route }: Props) {
  const { treatmentLogId, patientId } = route.params;
  const profile = useAuthStore((s) => s.profile);

  const [treatmentLog, setTreatmentLog] = useState<TreatmentLog | null>(null);
  const [monitoringId, setMonitoringId] = useState<string | null>(null);
  const [images, setImages] = useState<ImagingRecord[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const [preImagingId, setPreImagingId] = useState<string | null>(null);
  const [postImagingId, setPostImagingId] = useState<string | null>(null);
  const [nextImagingDate, setNextImagingDate] = useState("");
  const [responseNotes, setResponseNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: logData }, { data: monitoringData }, { data: imagingData }] = await Promise.all([
      supabase.from("treatment_logs").select("*").eq("id", treatmentLogId).single(),
      supabase
        .from("treatment_monitoring")
        .select("*")
        .eq("treatment_log_id", treatmentLogId)
        .maybeSingle(),
      supabase.from("imaging_records").select("*").eq("patient_id", patientId),
    ]);

    if (logData) setTreatmentLog(logData as TreatmentLog);

    if (monitoringData) {
      const m = monitoringData as MonitoringRow;
      setMonitoringId(m.id);
      setPreImagingId(m.pre_imaging_id);
      setPostImagingId(m.post_imaging_id);
      setNextImagingDate(m.next_imaging_due_date ?? "");
      setResponseNotes(m.response_notes ?? "");
    }

    if (imagingData) {
      const records = imagingData as ImagingRecord[];
      setImages(records);

      const renderablePaths = records
        .filter((r) => r.file_type === "PNG" || r.file_type === "JPEG")
        .map((r) => r.storage_path);

      if (renderablePaths.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from("patient-imaging")
          .createSignedUrls(renderablePaths, SIGNED_URL_EXPIRY_SECONDS);
        if (signedUrls) {
          const map: Record<string, string> = {};
          signedUrls.forEach((u) => {
            if (u.signedUrl && u.path) map[u.path] = u.signedUrl;
          });
          setPreviewUrls(map);
        }
      }
    }

    setLoading(false);
  }, [treatmentLogId, patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    setError(null);
    if (nextImagingDate.trim()) {
      const pattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!pattern.test(nextImagingDate.trim())) {
        setError("Next imaging due date must be in YYYY-MM-DD format.");
        return;
      }
    }

    setSaving(true);
    const payload = {
      treatment_log_id: treatmentLogId,
      pre_imaging_id: preImagingId,
      post_imaging_id: postImagingId,
      next_imaging_due_date: nextImagingDate.trim() || null,
      response_notes: responseNotes.trim() || null,
    };

    const { error: saveError, data } = monitoringId
      ? await supabase.from("treatment_monitoring").update(payload).eq("id", monitoringId).select().single()
      : await supabase.from("treatment_monitoring").insert(payload).select().single();

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    if (data && !monitoringId) setMonitoringId((data as MonitoringRow).id);

    if (profile) {
      await logAudit({
        userId: profile.id,
        institutionId: profile.institution_id,
        action: monitoringId ? "update" : "create",
        tableName: "treatment_monitoring",
        recordId: data?.id ?? monitoringId,
      });
    }
    Alert.alert("Saved", "Monitoring information has been updated.");
  };

  const handleExportPdf = async () => {
    if (!treatmentLog) return;
    setExporting(true);
    try {
      const html = `
        <html>
          <head><meta charset="utf-8" /></head>
          <body style="font-family: -apple-system, sans-serif; padding: 24px;">
            <h2 style="color:#1E3A5F;">Treatment Summary</h2>
            <p style="color:#6B7280; font-size:12px;">
              Record-keeping summary only — not a clinical outcome determination.
            </p>
            <table style="width:100%; border-collapse: collapse; margin-top:16px;">
              <tr><td style="padding:6px; font-weight:600;">Isotope</td><td style="padding:6px;">${treatmentLog.isotope}</td></tr>
              <tr><td style="padding:6px; font-weight:600;">Target</td><td style="padding:6px;">${treatmentLog.target_receptor_or_tissue ?? "—"}</td></tr>
              <tr><td style="padding:6px; font-weight:600;">Dose</td><td style="padding:6px;">${treatmentLog.dose_administered ?? "—"} ${treatmentLog.dose_unit ?? ""}</td></tr>
              <tr><td style="padding:6px; font-weight:600;">Dosimetry Source</td><td style="padding:6px;">${treatmentLog.dosimetry_source ?? "—"}</td></tr>
              <tr><td style="padding:6px; font-weight:600;">Administered Date</td><td style="padding:6px;">${treatmentLog.administered_date ?? "—"}</td></tr>
              <tr><td style="padding:6px; font-weight:600;">Next Imaging Due</td><td style="padding:6px;">${nextImagingDate || "—"}</td></tr>
              <tr><td style="padding:6px; font-weight:600;">Response Notes</td><td style="padding:6px;">${responseNotes || "—"}</td></tr>
            </table>
          </body>
        </html>`;

      const { uri } = await Print.printToFileAsync({ html });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
    } catch (e) {
      // non-critical
    } finally {
      setExporting(false);
    }
  };

  if (loading || !treatmentLog) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-5 pt-5">
      <Text className="text-lg font-semibold text-clinical-primary mb-1">
        {treatmentLog.isotope} {treatmentLog.target_receptor_or_tissue ? `· ${treatmentLog.target_receptor_or_tissue}` : ""}
      </Text>
      <Text className="text-xs text-gray-500 mb-6">
        Administered {treatmentLog.administered_date ?? "date not recorded"} · Dose {treatmentLog.dose_administered ?? "—"} {treatmentLog.dose_unit ?? ""}
      </Text>

      <Text className="text-sm font-medium text-gray-600 mb-2">Pre-Treatment Scan</Text>
      <ScanPicker
        images={images}
        previewUrls={previewUrls}
        selectedId={preImagingId}
        onSelect={setPreImagingId}
      />

      <Text className="text-sm font-medium text-gray-600 mb-2 mt-4">Post-Treatment Scan</Text>
      <ScanPicker
        images={images}
        previewUrls={previewUrls}
        selectedId={postImagingId}
        onSelect={setPostImagingId}
      />

      {preImagingId && postImagingId ? (
        <View className="flex-row mt-4 mb-2">
          <ComparisonThumb
            label="Pre"
            image={images.find((i) => i.id === preImagingId)}
            url={previewUrls[images.find((i) => i.id === preImagingId)?.storage_path ?? ""]}
          />
          <ComparisonThumb
            label="Post"
            image={images.find((i) => i.id === postImagingId)}
            url={previewUrls[images.find((i) => i.id === postImagingId)?.storage_path ?? ""]}
          />
        </View>
      ) : null}

      <Text className="text-xs font-medium text-gray-600 mb-1 mt-4">Next Imaging Due Date</Text>
      <AppTextInput
        value={nextImagingDate}
        onChangeText={setNextImagingDate}
        placeholder="YYYY-MM-DD"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
      />

      <Text className="text-xs font-medium text-gray-600 mb-1">Response Notes</Text>
      <AppTextInput
        value={responseNotes}
        onChangeText={setResponseNotes}
        placeholder="Physician's own assessment notes"
        multiline
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card h-24"
      />

      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}

      <Pressable
        onPress={handleSave}
        disabled={saving}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-3"
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium">Save Monitoring Info</Text>}
      </Pressable>

      <Pressable
        onPress={handleExportPdf}
        disabled={exporting}
        className="border border-clinical-primary rounded-lg py-3 items-center mb-10"
      >
        {exporting ? (
          <ActivityIndicator color="#1E3A5F" />
        ) : (
          <Text className="text-clinical-primary font-medium">Export Treatment Summary</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function ScanPicker({
  images,
  previewUrls,
  selectedId,
  onSelect,
}: {
  images: ImagingRecord[];
  previewUrls: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (images.length === 0) {
    return <Text className="text-xs text-gray-400 mb-2">No imaging records for this patient yet.</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
      {images.map((img) => (
        <Pressable
          key={img.id}
          onPress={() => onSelect(img.id)}
          className={`mr-2 rounded-lg overflow-hidden border-2 ${
            selectedId === img.id ? "border-clinical-primary" : "border-transparent"
          }`}
        >
          {previewUrls[img.storage_path] ? (
            <Image source={{ uri: previewUrls[img.storage_path] }} className="w-20 h-20" resizeMode="cover" />
          ) : (
            <View className="w-20 h-20 bg-gray-100 items-center justify-center">
              <Text className="text-[10px] text-gray-400 text-center px-1">DICOM</Text>
            </View>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ComparisonThumb({
  label,
  image,
  url,
}: {
  label: string;
  image: ImagingRecord | undefined;
  url: string | undefined;
}) {
  return (
    <View className="flex-1 mr-2">
      <Text className="text-xs text-gray-500 mb-1">{label}</Text>
      {url ? (
        <Image source={{ uri: url }} className="w-full h-32 rounded-lg" resizeMode="cover" />
      ) : (
        <View className="w-full h-32 bg-gray-100 rounded-lg items-center justify-center">
          <Text className="text-xs text-gray-400">
            {image?.file_type === "DICOM" ? "DICOM file" : "No preview"}
          </Text>
        </View>
      )}
    </View>
  );
}