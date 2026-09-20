import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import AppTextInput from "../../components/AppTextInput";

interface Props {
  onGoToSignUp: () => void;
}

export default function LoginScreen({ onGoToSignUp }: Props) {
  const signIn = useAuthStore((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
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

  const handleForgotPassword = async () => {
    setError(null);
    if (!email.trim()) {
      Alert.alert(
        "Email Required",
        "Please enter your email address above first, then tap Forgot Password."
      );
      return;
    }

    setResetSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo:
            "https://stevegts69-ai.github.io/auth-pages/reset-password.html",
        }
      );

      if (resetError) {
        const message =
          resetError.status === 429
            ? "Too many reset requests. Please wait a few minutes and try again."
            : resetError.message;
        setError(message);
        Alert.alert("Password Reset Error", message);
        return;
      }

      Alert.alert(
        "Check Your Email",
        "We've sent a password reset link to your email address."
      );
    } catch (resetException) {
      const message =
        resetException instanceof Error
          ? resetException.message
          : "Unable to send a password reset email. Check your connection and try again.";
      setError(message);
      Alert.alert("Password Reset Error", message);
    } finally {
      setResetSubmitting(false);
    }
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
        <AppTextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 bg-clinical-card"
          placeholder="you@institution.org"
        />

        <Text className="text-xs font-medium text-gray-600 mb-1">Password</Text>
        <View className="relative mb-2">
          <AppTextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            className="border border-gray-300 rounded-lg px-4 py-3 pr-12 bg-clinical-card"
            placeholder="••••••••"
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

        {/* Forgot Password Link */}
        <Pressable
          onPress={handleForgotPassword}
          disabled={resetSubmitting}
          className="items-end mb-4"
        >
          <Text className="text-xs text-clinical-primary font-medium">
            {resetSubmitting ? "Sending reset link..." : "Forgot Password?"}
          </Text>
        </Pressable>

        {error ? (
          <Text className="text-clinical-danger text-sm mb-2">{error}</Text>
        ) : null}

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="bg-clinical-primary rounded-lg py-3 items-center mt-2"
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-medium">Sign In</Text>
          )}
        </Pressable>

        <Pressable onPress={onGoToSignUp} className="items-center mt-4">
          <Text className="text-clinical-primary text-sm">
            New here? Create an account
          </Text>
        </Pressable>

        <Text className="text-xs text-gray-400 mt-8 text-center">
          Access is limited to credentialed institution staff. All access is logged.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}