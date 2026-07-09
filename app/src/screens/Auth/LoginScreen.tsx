import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useAuthStore } from "../../store/authStore";

export default function LoginScreen() {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) setError(signInError);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-clinical-bg"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-2xl font-semibold text-clinical-primary mb-1">
          Metabolic Nuclear Medicine Platform
        </Text>
        <Text className="text-sm text-gray-500 mb-8">
          Clinical record-keeping &amp; monitoring — sign in with your institution credentials
        </Text>

        <Text className="text-xs font-medium text-gray-600 mb-1">Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
          placeholder="you@institution.org"
        />

        <Text className="text-xs font-medium text-gray-600 mb-1">Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          className="border border-gray-300 rounded-lg px-4 py-3 mb-2 bg-clinical-card"
          placeholder="••••••••"
        />

        {error ? (
          <Text className="text-clinical-danger text-sm mb-2">{error}</Text>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="bg-clinical-primary rounded-lg py-3 items-center mt-4"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-medium">Sign In</Text>
          )}
        </Pressable>

        <Text className="text-xs text-gray-400 mt-8 text-center">
          Access is limited to credentialed institution staff. All access is logged.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
