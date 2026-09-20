import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import AppTextInput from "../../components/AppTextInput";
import { supabase } from "../../lib/supabase";
import type { UserRole } from "../../types";

interface Props {
  onSignedUp: () => void;
  onBackToLogin: () => void;
}

const SELF_SIGNUP_ROLES: { value: UserRole; label: string }[] = [
  { value: "physician", label: "Physician" },
  { value: "radiologist", label: "Radiologist" },
  { value: "nuclear_med_physicist", label: "Nuclear Med. Physicist" },
];

// Replace these URLs with your exact hosted GitHub Pages links
const PRIVACY_POLICY_URL = "https://stevegts69-ai.github.io/auth-pages/privacy.html";
const TERMS_OF_SERVICE_URL = "https://stevegts69-ai.github.io/auth-pages/terms.html";

export default function SignUpScreen({ onSignedUp, onBackToLogin }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [role, setRole] = useState<UserRole>("physician");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!fullName.trim()) return "Enter your full name.";
    if (!email.trim()) return "Enter your email.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!inviteCode.trim()) return "Enter your institution's invite code.";
    if (!agreedToTerms)
      return "You must agree to the Privacy Policy and Terms of Service to continue.";
    return null;
  };

  const handleSignUp = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role,
          invite_code: inviteCode.trim(),
        },
      },
    });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    Alert.alert(
      "Check your email",
      "We've sent a confirmation link to your email. Confirm it, then sign in — your account will need approval from your institution's admin before you can start recording patient data.",
      [{ text: "OK", onPress: onSignedUp }]
    );
  };

  const openWebUrl = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Unable to open legal pages in browser.");
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
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-2xl font-semibold text-clinical-primary mb-1 mt-4">
            Create Account
          </Text>
          <Text className="text-sm text-gray-500 mb-6">
            You'll need an invite code from your institution to sign up.
          </Text>

          <Text className="text-xs font-medium text-gray-600 mb-1">Full Name</Text>
          <AppTextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Dr. Jane Doe"
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
          />

          <Text className="text-xs font-medium text-gray-600 mb-1">Email</Text>
          <AppTextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@institution.org"
            className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
          />

          <Text className="text-xs font-medium text-gray-600 mb-1">Password</Text>
          <View className="relative mb-4">
            <AppTextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="At least 8 characters"
              className="border border-gray-300 rounded-lg px-4 py-3 pr-12 bg-clinical-card"
            />
            <Pressable
              onPress={() => setShowPassword((visible) => !visible)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0 top-0 bottom-0 w-12 items-center justify-center"
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#64748b"
              />
            </Pressable>
          </View>

          <Text className="text-xs font-medium text-gray-600 mb-1">Role</Text>
          <View className="flex-row flex-wrap mb-4">
            {SELF_SIGNUP_ROLES.map((r) => (
              <Pressable
                key={r.value}
                onPress={() => setRole(r.value)}
                className={`px-4 py-2 rounded-lg mr-2 mb-2 border ${
                  role === r.value
                    ? "bg-clinical-primary border-clinical-primary"
                    : "bg-clinical-card border-gray-300"
                }`}
              >
                <Text className={role === r.value ? "text-white" : "text-gray-700"}>
                  {r.label}
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
            Get this from your institution's admin — it's how we know which hospital's records
            you should have access to.
          </Text>

          {/* Hosted Legal Links Checkbox */}
          <View className="flex-row items-start mb-4">
            <Pressable
              onPress={() => setAgreedToTerms((v) => !v)}
              className={`w-5 h-5 rounded border mr-3 mt-0.5 items-center justify-center ${
                agreedToTerms ? "bg-clinical-primary border-clinical-primary" : "border-gray-400"
              }`}
            >
              {agreedToTerms ? <Text className="text-white text-xs">✓</Text> : null}
            </Pressable>
            <Text className="text-xs text-gray-600 flex-1 leading-5">
              I agree to the{" "}
              <Text
                className="text-clinical-primary font-medium"
                onPress={() => openWebUrl(PRIVACY_POLICY_URL)}
              >
                Privacy Policy
              </Text>{" "}
              and{" "}
              <Text
                className="text-clinical-primary font-medium"
                onPress={() => openWebUrl(TERMS_OF_SERVICE_URL)}
              >
                Terms of Service
              </Text>
            </Text>
          </View>

          {error ? <Text className="text-clinical-danger text-sm mb-3">{error}</Text> : null}

          <Pressable
            onPress={handleSignUp}
            disabled={submitting}
            className="bg-clinical-primary rounded-lg py-3 items-center mt-2"
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-medium">Create Account</Text>
            )}
          </Pressable>

          <View className="py-6 items-center">
            <Pressable onPress={onBackToLogin} hitSlop={12}>
              <Text className="text-clinical-primary text-sm font-medium">
                Already have an account? Sign in
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}