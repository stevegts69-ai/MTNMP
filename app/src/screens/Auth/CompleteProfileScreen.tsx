import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppTextInput from "../../components/AppTextInput";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import type { UserRole } from "../../types";

const PRIVACY_POLICY_URL = "https://stevegts69-ai.github.io/auth-pages/privacy.html";
const TERMS_OF_SERVICE_URL = "https://stevegts69-ai.github.io/auth-pages/terms.html";

const SIGNUP_ROLES: { value: Exclude<UserRole, "admin">; label: string }[] = [
  { value: "physician", label: "Physician" },
  { value: "radiologist", label: "Radiologist" },
  { value: "nuclear_med_physicist", label: "Nuclear Med. Physicist" },
];

export default function CompleteProfileScreen() {
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Exclude<UserRole, "admin">>("physician");
  const [inviteCode, setInviteCode] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openWebUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Unable to open legal pages in browser.");
    }
  };

  const handleCompleteProfile = async () => {
    setError(null);
    if (!agreedToTerms) return;
    if (!fullName.trim()) {
      setError("Enter your full name.");
      return;
    }
    if (!inviteCode.trim()) {
      setError("Enter your institution's invite code.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim(),
          role,
          invite_code: inviteCode.trim(),
        },
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      const { error: createProfileError } = await supabase.rpc("complete_signup_profile");
      if (createProfileError) {
        setError(createProfileError.message);
        return;
      }

      const refreshError = await refreshProfile();
      if (refreshError) setError(refreshError);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to complete your profile. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-clinical-bg" edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-2xl font-semibold text-clinical-primary mb-2">
            Complete Your Profile
          </Text>
          <Text className="text-sm text-gray-500 mb-8">
            Add your institution details to finish creating your account. An admin must verify
            your credentials before you can record patient data.
          </Text>

          <Text className="text-xs font-medium text-gray-600 mb-1">Full Name</Text>
          <AppTextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Dr. Jane Doe"
            autoCapitalize="words"
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
          />

          <Text className="text-xs font-medium text-gray-600 mb-1">Role</Text>
          <View className="flex-row flex-wrap mb-4">
            {SIGNUP_ROLES.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setRole(option.value)}
                className={`px-4 py-2 rounded-lg mr-2 mb-2 border ${
                  role === option.value
                    ? "bg-clinical-primary border-clinical-primary"
                    : "bg-clinical-card border-gray-300"
                }`}
              >
                <Text className={role === option.value ? "text-white" : "text-gray-700"}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-xs font-medium text-gray-600 mb-1">Institution Invite Code</Text>
          <AppTextInput
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            placeholder="e.g. TESTHOSP-2026"
            className="border border-gray-300 rounded-lg px-4 py-3 mb-2 bg-clinical-card"
          />
          <Text className="text-xs text-gray-400 mb-4">
            Get this from your institution's admin.
          </Text>

          <View className="flex-row items-start mb-4">
            <Pressable
              onPress={() => setAgreedToTerms((agreed) => !agreed)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreedToTerms }}
              accessibilityLabel="Agree to the Terms of Service and Privacy Policy"
              className={`w-5 h-5 rounded border mr-3 mt-0.5 items-center justify-center ${
                agreedToTerms
                  ? "bg-clinical-primary border-clinical-primary"
                  : "border-gray-400"
              }`}
            >
              {agreedToTerms ? <Text className="text-white text-xs">✓</Text> : null}
            </Pressable>
            <Text className="text-xs text-gray-600 flex-1 leading-5">
              I agree to the{" "}
              <Text
                className="text-clinical-primary font-medium"
                onPress={() => openWebUrl(TERMS_OF_SERVICE_URL)}
              >
                Terms of Service
              </Text>
              {" "}and{" "}
              <Text
                className="text-clinical-primary font-medium"
                onPress={() => openWebUrl(PRIVACY_POLICY_URL)}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </View>

          {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}

          <Pressable
            onPress={handleCompleteProfile}
            disabled={submitting || !agreedToTerms}
            className={`rounded-lg py-3 items-center mt-2 ${
              agreedToTerms ? "bg-clinical-primary" : "bg-gray-400"
            }`}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-medium">Complete Profile</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}