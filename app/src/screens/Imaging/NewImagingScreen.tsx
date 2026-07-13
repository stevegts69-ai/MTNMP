import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { ScanType, FileType } from "../../types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { PatientsStackParamList } from "../../navigation/PatientsStack";

type Props = NativeStackScreenProps<PatientsStackParamList, "NewImaging">;

const SCAN_TYPES: ScanType[] = ["PET_CT", "SPECT", "MRI", "other"];

interface PickedFile {
  uri: string;
  name: string;
  mimeType: string | null;
  fileType: FileType;
}

export default function NewImagingScreen({ route, navigation }: Props) {
  const { patientId } = route.params;
  const profile = useAuthStore((s) => s.profile);

  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [scanType, setScanType] = useState<ScanType>("PET_CT");
  const [scanDate, setScanDate] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectFileType = (mimeType: string | null, name: string): FileType => {
    const lower = name.toLowerCase();
    if (mimeType === "image/png" || lower.endsWith(".png")) return "PNG";
    if (mimeType === "image/jpeg" || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "JPEG";
    return "DICOM"; // .dcm or anything unrecognized is treated as DICOM/opaque, per our rendering strategy
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission is required to attach an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ["images"],
  quality: 0.9,
});
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const name = asset.fileName ?? `image_${Date.now()}.jpg`;
    setPicked({
      uri: asset.uri,
      name,
      mimeType: asset.mimeType ?? null,
      fileType: detectFileType(asset.mimeType ?? null, name),
    });
    setError(null);
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
  type: "*/*",
  copyToCacheDirectory: true,
});
  

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setPicked({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? null,
      fileType: detectFileType(asset.mimeType ?? null, asset.name),
    });
    setError(null);
  };

  const validate = (): string | null => {
    if (!picked) return "Select a file to upload.";
    if (scanDate.trim()) {
      const pattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!pattern.test(scanDate.trim())) return "Scan date must be in YYYY-MM-DD format.";
    }
    return null;
  };

  const handleUpload = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!profile?.institution_id || !picked) return;

    setUploading(true);
    try {
      const ext = picked.name.includes(".") ? picked.name.split(".").pop() : "bin";
      const storagePath = `${profile.institution_id}/${patientId}/${Date.now()}.${ext}`;

      const base64 = await FileSystem.readAsStringAsync(picked.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { error: uploadError } = await supabase.storage
        .from("patient-imaging")
        .upload(storagePath, decode(base64), {
          contentType: picked.mimeType ?? "application/octet-stream",
        });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("imaging_records").insert({
        patient_id: patientId,
        institution_id: profile.institution_id,
        scan_type: scanType,
        storage_path: storagePath,
        file_type: picked.fileType,
        scan_date: scanDate.trim() || null,
        notes: notes.trim() || null,
        uploaded_by: profile.id,
      });

      if (insertError) throw insertError;

      Alert.alert("Scan uploaded", "The imaging record has been saved.");
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-clinical-bg px-5 pt-4" keyboardShouldPersistTaps="handled">
      <Text className="text-lg font-semibold text-clinical-primary mb-4">Upload Scan</Text>

      {picked ? (
        <View className="mb-4">
          {picked.fileType === "PNG" || picked.fileType === "JPEG" ? (
            <Image source={{ uri: picked.uri }} className="w-full h-40 rounded-lg mb-2" resizeMode="cover" />
          ) : (
            <View className="bg-gray-100 rounded-lg h-24 items-center justify-center mb-2">
              <Text className="text-gray-500 text-xs">{picked.name}</Text>
            </View>
          )}
          <Pressable onPress={() => setPicked(null)}>
            <Text className="text-clinical-danger text-xs text-center">Remove file</Text>
          </Pressable>
        </View>
      ) : (
        <View className="flex-row mb-4">
          <Pressable
            onPress={pickImage}
            className="flex-1 bg-clinical-card border border-gray-300 rounded-lg py-4 items-center mr-2"
          >
            <Text className="text-clinical-primary font-medium">Choose Image</Text>
            <Text className="text-xs text-gray-400 mt-1">PNG / JPEG</Text>
          </Pressable>
          <Pressable
            onPress={pickDocument}
            className="flex-1 bg-clinical-card border border-gray-300 rounded-lg py-4 items-center ml-2"
          >
            <Text className="text-clinical-primary font-medium">Choose File</Text>
            <Text className="text-xs text-gray-400 mt-1">DICOM / other</Text>
          </Pressable>
        </View>
      )}

      <Text className="text-xs font-medium text-gray-600 mb-1">Scan Type</Text>
      <View className="flex-row flex-wrap mb-4">
        {SCAN_TYPES.map((type) => (
          <Pressable
            key={type}
            onPress={() => setScanType(type)}
            className={`px-4 py-2 rounded-lg mr-2 mb-2 border ${
              scanType === type
                ? "bg-clinical-primary border-clinical-primary"
                : "bg-clinical-card border-gray-300"
            }`}
          >
            <Text className={scanType === type ? "text-white" : "text-gray-700"}>
              {type.replace("_", "/")}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-xs font-medium text-gray-600 mb-1">Scan Date</Text>
      <TextInput
        value={scanDate}
        onChangeText={setScanDate}
        placeholder="YYYY-MM-DD"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
      />

      <Text className="text-xs font-medium text-gray-600 mb-1">Notes</Text>
      <TextInput
        value={notes}
        onChangeText={setNotes}
        placeholder="Optional"
        multiline
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card h-20"
      />

      {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}

      <Pressable
        onPress={handleUpload}
        disabled={uploading || !picked}
        className={`rounded-lg py-3 items-center mb-10 ${
          uploading || !picked ? "bg-gray-300" : "bg-clinical-primary"
        }`}
      >
        {uploading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium">Upload</Text>}
      </Pressable>
    </ScrollView>
  );
}