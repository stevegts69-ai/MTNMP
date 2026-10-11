import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppTextInput from "../../components/AppTextInput";
import { logAudit } from "../../lib/audit";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { IsotopeType } from "../../types";

const ISOTOPES: { value: IsotopeType; label: string }[] = [
  { value: "Lu177", label: "Lu-177" },
  { value: "Y90", label: "Y-90" },
  { value: "I131", label: "I-131" },
  { value: "Ra223", label: "Ra-223" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "sw", label: "Kiswahili" },
] as const;

interface InstitutionContent {
  emergency_contact_name: string | null;
  emergency_phone: string | null;
  after_hours_phone: string | null;
}

export default function InstitutionContentManagementScreen() {
  const profile = useAuthStore((state) => state.profile);
  const institutionId = profile?.institution_id;
  const isAuthorized = profile?.role === "admin" && profile.credential_verified;

  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [afterHoursPhone, setAfterHoursPhone] = useState("");
  const [savingContacts, setSavingContacts] = useState(false);

  const [isotope, setIsotope] = useState<IsotopeType>("Lu177");
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [checklistTemplateId, setChecklistTemplateId] = useState<string | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(true);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]["value"]>("en");
  const [instructionBody, setInstructionBody] = useState("");
  const [instructionTemplateId, setInstructionTemplateId] = useState<string | null>(null);
  const [loadingInstructions, setLoadingInstructions] = useState(true);
  const [savingInstructions, setSavingInstructions] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInstitutionContacts = useCallback(async () => {
    if (!institutionId) return;
    const { data, error } = await supabase
      .from("institutions")
      .select("emergency_contact_name, emergency_phone, after_hours_phone")
      .eq("id", institutionId)
      .single();
    if (error) {
      setLoadError(error.message);
      return;
    }
    const contacts = data as InstitutionContent;
    setEmergencyName(contacts.emergency_contact_name ?? "");
    setEmergencyPhone(contacts.emergency_phone ?? "");
    setAfterHoursPhone(contacts.after_hours_phone ?? "");
  }, [institutionId]);

  const loadChecklistTemplate = useCallback(async () => {
    if (!institutionId) return;
    setLoadingChecklist(true);
    const { data, error } = await supabase
      .from("discharge_checklist_templates")
      .select("id, checklist_items")
      .eq("institution_id", institutionId)
      .eq("isotope", isotope)
      .maybeSingle();
    if (error) {
      setLoadError(error.message);
    } else {
      const template = data as { id: string; checklist_items: { item: string }[] } | null;
      setChecklistTemplateId(template?.id ?? null);
      setChecklistItems((template?.checklist_items ?? []).map((entry) => entry.item));
    }
    setLoadingChecklist(false);
  }, [institutionId, isotope]);

  const loadInstructionTemplate = useCallback(async () => {
    if (!institutionId) return;
    setLoadingInstructions(true);
    const { data, error } = await supabase
      .from("discharge_instruction_templates")
      .select("id, body_text")
      .eq("institution_id", institutionId)
      .eq("isotope", isotope)
      .eq("language", language)
      .maybeSingle();
    if (error) {
      setLoadError(error.message);
    } else {
      const template = data as { id: string; body_text: string } | null;
      setInstructionTemplateId(template?.id ?? null);
      setInstructionBody(template?.body_text ?? "");
    }
    setLoadingInstructions(false);
  }, [institutionId, isotope, language]);

  useEffect(() => {
    if (!isAuthorized) return;
    loadInstitutionContacts();
  }, [isAuthorized, loadInstitutionContacts]);

  useEffect(() => {
    if (!isAuthorized) return;
    loadChecklistTemplate();
  }, [isAuthorized, loadChecklistTemplate]);

  useEffect(() => {
    if (!isAuthorized) return;
    loadInstructionTemplate();
  }, [isAuthorized, loadInstructionTemplate]);

  const saveContacts = async () => {
    if (!institutionId || !profile) return;
    setSavingContacts(true);
    const { error } = await supabase
      .from("institutions")
      .update({
        emergency_contact_name: emergencyName.trim() || null,
        emergency_phone: emergencyPhone.trim() || null,
        after_hours_phone: afterHoursPhone.trim() || null,
      })
      .eq("id", institutionId);
    setSavingContacts(false);
    if (error) {
      Alert.alert("Could not save contacts", error.message);
      return;
    }
    await logAudit({
      userId: profile.id,
      institutionId,
      action: "update",
      tableName: "institutions",
      recordId: institutionId,
    });
    Alert.alert("Saved", "Emergency contacts have been updated.");
  };

  const saveChecklist = async () => {
    if (!institutionId || !profile) return;
    const items = checklistItems.map((item) => item.trim()).filter(Boolean);
    if (items.length === 0) {
      Alert.alert("Checklist is empty", "Add at least one institution-approved checklist item.");
      return;
    }
    setSavingChecklist(true);
    const { data, error } = await supabase
      .from("discharge_checklist_templates")
      .upsert(
        {
          institution_id: institutionId,
          isotope,
          checklist_items: items.map((item) => ({ item })),
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "institution_id,isotope" }
      )
      .select("id")
      .single();
    setSavingChecklist(false);
    if (error) {
      Alert.alert("Could not save checklist", error.message);
      return;
    }
    setChecklistTemplateId(data.id);
    await logAudit({
      userId: profile.id,
      institutionId,
      action: checklistTemplateId ? "update" : "create",
      tableName: "discharge_checklist_templates",
      recordId: data.id,
    });
    Alert.alert("Saved", `${ISOTOPES.find((entry) => entry.value === isotope)?.label} checklist template updated.`);
  };

  const saveInstructions = async () => {
    if (!institutionId || !profile) return;
    if (!instructionBody.trim()) {
      Alert.alert("Instructions are empty", "Enter the institution-approved instruction text.");
      return;
    }
    setSavingInstructions(true);
    const { data, error } = await supabase
      .from("discharge_instruction_templates")
      .upsert(
        {
          institution_id: institutionId,
          isotope,
          language,
          body_text: instructionBody.trim(),
          updated_by: profile.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "institution_id,isotope,language" }
      )
      .select("id")
      .single();
    setSavingInstructions(false);
    if (error) {
      Alert.alert("Could not save instructions", error.message);
      return;
    }
    setInstructionTemplateId(data.id);
    await logAudit({
      userId: profile.id,
      institutionId,
      action: instructionTemplateId ? "update" : "create",
      tableName: "discharge_instruction_templates",
      recordId: data.id,
    });
    Alert.alert("Saved", "Patient instruction template updated.");
  };

  if (!isAuthorized || !institutionId) {
    return (
      <SafeAreaView className="flex-1 bg-clinical-bg items-center justify-center px-8">
        <Text className="text-base font-semibold text-clinical-primary text-center">
          Admin access required
        </Text>
        <Text className="text-sm text-gray-500 text-center mt-2">
          This screen is available only to credential-verified institution admins.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-clinical-bg" edges={["bottom", "left", "right"]}>
      <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
        <Text className="text-xl font-semibold text-clinical-primary mb-1">
          Institution Content
        </Text>
        <Text className="text-xs text-gray-500 mb-5">
          Manage the institution-owned discharge contact and documentation templates.
        </Text>
        {loadError ? <Text className="text-sm text-clinical-danger mb-4">{loadError}</Text> : null}

        <Section title="Emergency contacts">
          <FieldLabel label="Emergency contact name" />
          <AppTextInput
            value={emergencyName}
            onChangeText={setEmergencyName}
            placeholder="Contact name"
            className="border border-gray-300 rounded-lg px-4 py-3 mb-3 bg-clinical-card"
          />
          <FieldLabel label="Emergency phone" />
          <AppTextInput
            value={emergencyPhone}
            onChangeText={setEmergencyPhone}
            keyboardType="phone-pad"
            placeholder="Phone number"
            className="border border-gray-300 rounded-lg px-4 py-3 mb-3 bg-clinical-card"
          />
          <FieldLabel label="After-hours phone" />
          <AppTextInput
            value={afterHoursPhone}
            onChangeText={setAfterHoursPhone}
            keyboardType="phone-pad"
            placeholder="After-hours number"
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
          />
          <SaveButton label="Save Emergency Contacts" saving={savingContacts} onPress={saveContacts} />
        </Section>

        <Section title="Discharge checklist templates">
          <IsotopeSelector isotope={isotope} setIsotope={setIsotope} />
          <Text className="text-xs text-gray-500 mb-3">
            Enter only the items approved by your institution's discharge protocol.
          </Text>
          {loadingChecklist ? (
            <ActivityIndicator color="#1E3A5F" />
          ) : (
            <>
              {checklistItems.map((item, index) => (
                <View key={index} className="flex-row items-center mb-2">
                  <AppTextInput
                    value={item}
                    onChangeText={(value) =>
                      setChecklistItems((current) => current.map((entry, i) => i === index ? value : entry))
                    }
                    placeholder={`Checklist item ${index + 1}`}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-3 bg-clinical-card"
                  />
                  <Pressable
                    onPress={() => setChecklistItems((current) => current.filter((_, i) => i !== index))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove checklist item ${index + 1}`}
                    className="w-12 h-12 ml-2 items-center justify-center rounded-lg border border-gray-300 bg-white"
                  >
                    <Text className="text-clinical-danger text-lg">×</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() => setChecklistItems((current) => [...current, ""])}
                className="border border-clinical-primary rounded-lg py-3 items-center mb-3"
              >
                <Text className="text-sm font-medium text-clinical-primary">+ Add Checklist Item</Text>
              </Pressable>
              <SaveButton label="Save Checklist Template" saving={savingChecklist} onPress={saveChecklist} />
            </>
          )}
        </Section>

        <Section title="Patient instruction templates">
          <IsotopeSelector isotope={isotope} setIsotope={setIsotope} />
          <View className="flex-row mb-3">
            {LANGUAGES.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setLanguage(option.value)}
                className={`px-4 py-2 mr-2 rounded-lg border ${language === option.value ? "bg-clinical-primary border-clinical-primary" : "bg-clinical-card border-gray-300"}`}
              >
                <Text className={language === option.value ? "text-white text-xs" : "text-gray-700 text-xs"}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {loadingInstructions ? (
            <ActivityIndicator color="#1E3A5F" />
          ) : (
            <>
              <AppTextInput
                value={instructionBody}
                onChangeText={setInstructionBody}
                placeholder="Enter institution-approved instructions in plain text"
                multiline
                textAlignVertical="top"
                className="border border-gray-300 rounded-lg px-4 py-3 mb-3 bg-clinical-card min-h-48"
              />
              <SaveButton label="Save Instruction Template" saving={savingInstructions} onPress={saveInstructions} />
            </>
          )}
        </Section>
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <Text className="text-base font-semibold text-clinical-primary mb-4">{title}</Text>
      {children}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text className="text-xs font-medium text-gray-600 mb-1">{label}</Text>;
}

function SaveButton({ label, saving, onPress }: { label: string; saving: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={saving}
      className="bg-clinical-primary rounded-lg py-3 items-center mb-1"
    >
      {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium">{label}</Text>}
    </Pressable>
  );
}

function IsotopeSelector({
  isotope,
  setIsotope,
}: {
  isotope: IsotopeType;
  setIsotope: (isotope: IsotopeType) => void;
}) {
  return (
    <View className="flex-row flex-wrap mb-3">
      {ISOTOPES.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => setIsotope(option.value)}
          className={`px-3 py-2 mr-2 mb-2 rounded-lg border ${isotope === option.value ? "bg-clinical-primary border-clinical-primary" : "bg-clinical-card border-gray-300"}`}
        >
          <Text className={isotope === option.value ? "text-white text-xs" : "text-gray-700 text-xs"}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}