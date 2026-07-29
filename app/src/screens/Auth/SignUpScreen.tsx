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
} from "react-native";
import AppTextInput from "../../components/AppTextInput";
import { supabase } from "../../lib/supabase";
import type { UserRole } from "../../types";

interface Props {
  onSignedUp: () => void;
  onBackToLogin: () => void;
}

// Admin accounts are deliberately excluded from self-signup — an institution's
// first admin should be set up directly by whoever manages the deployment,
// not selectable by anyone who has an invite code.
const SELF_SIGNUP_ROLES: { value: UserRole; label: string }[] = [
  { value: "physician", label: "Physician" },
  { value: "radiologist", label: "Radiologist" },
  { value: "nuclear_med_physicist", label: "Nuclear Med. Physicist" },
];

export default function SignUpScreen({ onSignedUp, onBackToLogin }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [role, setRole] = useState<UserRole>("physician");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!fullName.trim()) return "Enter your full name.";
    if (!email.trim()) return "Enter your email.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!inviteCode.trim()) return "Enter your institution's invite code.";
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-clinical-bg"
    >
      <ScrollView className="flex-1 px-6 pt-4" keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-semibold text-clinical-primary mb-1 mt-6">
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
        <AppTextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
        />

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
          Get this from your institution's admin — it's how we know which
          hospital's records you should have access to.
        </Text>

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

        <Pressable onPress={onBackToLogin} className="items-center mt-4 mb-10">
          <Text className="text-clinical-primary text-sm">
            Already have an account? Sign in
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}