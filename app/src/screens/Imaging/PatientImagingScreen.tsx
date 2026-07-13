import React, { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, Image, ActivityIndicator } from "react-native";
import { supabase } from "../../lib/supabase";
import type { ImagingRecord } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "PatientImaging">;

const SIGNED_URL_EXPIRY_SECONDS = 60 * 10; // 10 minutes — just enough to view this screen

export default function PatientImagingScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const [records, setRecords] = useState<ImagingRecord[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from("imaging_records")
      .select("*")
      .eq("patient_id", patientId)
      .order("scan_date", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }
    setRecords(data as ImagingRecord[]);

    // Only PNG/JPEG get rendered inline — batch-request signed URLs for those.
    const renderablePaths = (data as ImagingRecord[])
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
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadRecords);
    return unsubscribe;
  }, [navigation, loadRecords]);

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
        onPress={() => navigation.navigate("NewImaging", { patientId })}
        className="bg-clinical-primary rounded-lg py-3 items-center mb-4"
      >
        <Text className="text-white font-medium">+ Upload Scan</Text>
      </Pressable>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Text className="text-gray-400 text-center">
              No imaging records yet for this patient.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-clinical-card rounded-xl p-4 mb-3 border border-gray-100">
            {item.file_type === "DICOM" ? (
              <View className="bg-gray-100 rounded-lg h-32 items-center justify-center mb-2">
                <Text className="text-gray-400 text-xs text-center px-4">
                  DICOM file — view on PACS workstation
                </Text>
              </View>
            ) : previewUrls[item.storage_path] ? (
              <Image
                source={{ uri: previewUrls[item.storage_path] }}
                className="w-full h-40 rounded-lg mb-2"
                resizeMode="cover"
              />
            ) : (
              <View className="bg-gray-100 rounded-lg h-32 items-center justify-center mb-2">
                <Text className="text-gray-400 text-xs">Preview unavailable</Text>
              </View>
            )}
            <Text className="text-sm font-medium text-clinical-primary">
              {item.scan_type} {item.scan_date ? `· ${item.scan_date}` : ""}
            </Text>
            {item.notes ? (
              <Text className="text-xs text-gray-500 mt-1">{item.notes}</Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}