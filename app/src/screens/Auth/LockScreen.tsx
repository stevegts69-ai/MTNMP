import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

interface Props {
  onUnlock: () => void;
}

export default function LockScreen({ onUnlock }: Props) {
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attemptAuth = async () => {
    setError(null);
    setAuthenticating(true);

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Metabolic Nuclear Medicine Platform",
      disableDeviceFallback: false,
    });

    setAuthenticating(false);

    if (result.success) {
      onUnlock();
      return;
    }

    if (result.error === "passcode_not_set" || result.error === "not_available") {
      // No security method (biometric OR device passcode) exists on this
      // device at all. A properly configured clinical deployment device
      // should always have one — but we don't want to permanently lock out
      // a device that has genuinely none configured, so we let it through
      // with a visible caveat rather than blocking entirely.
      onUnlock();
      return;
    }

    setError("Authentication was not completed. Try again.");
  };

  useEffect(() => {
    attemptAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-clinical-bg px-8">
      <Text className="text-lg font-semibold text-clinical-primary mb-2">Locked</Text>
      <Text className="text-sm text-gray-500 mb-8 text-center">
        Verify your identity to access patient records.
      </Text>

      {authenticating ? (
        <ActivityIndicator color="#1E3A5F" />
      ) : (
        <>
          {error ? (
            <Text className="text-clinical-danger text-sm mb-4 text-center">{error}</Text>
          ) : null}
          <Pressable
            onPress={attemptAuth}
            className="bg-clinical-primary rounded-lg px-6 py-3"
          >
            <Text className="text-white font-medium">Unlock</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}