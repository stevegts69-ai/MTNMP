import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

interface SignUpScreenProps {
  onSignedUp?: () => void;
  onBackToLogin?: () => void;
}

export default function SignUpScreen({ onSignedUp, onBackToLogin }: SignUpScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert('Sign Up Failed', error.message);
    } else {
      Alert.alert(
        'Success',
        'Account created successfully! Please check your email for confirmation.'
      );
      if (onSignedUp) {
        onSignedUp();
      } else if (onBackToLogin) {
        onBackToLogin();
      }
    }
    setLoading(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-clinical-bg" edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          className="px-6 py-6"
        >
          <View className="flex-1 justify-center">
            {/* Header */}
            <View className="mb-8">
              <Text className="text-3xl font-bold text-clinical-text mb-2">
                Create Account
              </Text>
              <Text className="text-base text-gray-600">
                Sign up to get started with your account
              </Text>
            </View>

            {/* Form Fields */}
            <View className="space-y-4">
              <View>
                <Text className="text-sm font-medium text-clinical-text mb-1">
                  Email
                </Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-clinical-text"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-clinical-text mb-1">
                  Password
                </Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create a password"
                  secureTextEntry
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-clinical-text"
                />
              </View>

              <View>
                <Text className="text-sm font-medium text-clinical-text mb-1">
                  Confirm Password
                </Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  secureTextEntry
                  className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-clinical-text"
                />
              </View>

              <TouchableOpacity
                onPress={handleSignUp}
                disabled={loading}
                className="w-full bg-clinical-primary rounded-lg py-4 items-center mt-4"
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-semibold text-base">
                    Sign Up
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer Link */}
          <View className="py-4 items-center">
            <TouchableOpacity onPress={onBackToLogin} activeOpacity={0.7}>
              <Text className="text-sm text-gray-600">
                Already have an account?{' '}
                <Text className="text-clinical-primary font-bold">Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}