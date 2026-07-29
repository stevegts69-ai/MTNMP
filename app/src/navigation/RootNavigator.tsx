import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { View, Text, Pressable, ActivityIndicator, AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../store/authStore";
import LoginScreen from "../screens/Auth/LoginScreen";
import SignUpScreen from "../screens/Auth/SignUpScreen";
import LockScreen from "../screens/Auth/LockScreen";
import OnboardingScreen from "../screens/Onboarding/OnboardingScreen";
import MainTabs from "./MainTabs";

const ONBOARDING_SEEN_KEY = "has_seen_onboarding";

export default function RootNavigator() {
  const { session, loading, profileError, initialize, signOut } = useAuthStore();
  const [unlocked, setUnlocked] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Onboarding shows once ever, on first launch — not tied to login state,
  // so it's the very first thing anyone sees, before they even reach the
  // login screen.
  useEffect(() => {
    (async () => {
      const seen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
      setShowOnboarding(!seen);
      setOnboardingChecked(true);
    })();
  }, []);

  const completeOnboarding = () => {
    AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "true").catch(() => {});
    setShowOnboarding(false);
  };

  // Re-lock whenever the app leaves the foreground — this is the standard
  // clinical-app pattern: biometric gate isn't a one-time login step, it's
  // a screen lock that re-engages every time the app is backgrounded.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appState.current === "active" && nextState.match(/inactive|background/)) {
        setUnlocked(false);
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  if (loading || !onboardingChecked) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  // Signed in, but their profile couldn't be created/found — most likely
  // an invalid invite code at signup. Don't let them fall through into
  // the main app with no institution context; show a clear, recoverable
  // error instead.
  if (session && profileError) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg px-8">
        <Text className="text-lg font-semibold text-clinical-primary mb-2">
          Account setup incomplete
        </Text>
        <Text className="text-sm text-gray-600 text-center mb-6">{profileError}</Text>
        <Pressable
          onPress={() => signOut()}
          className="bg-clinical-primary rounded-lg px-6 py-3"
        >
          <Text className="text-white font-medium">Sign Out</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {showOnboarding ? (
        <OnboardingScreen onComplete={completeOnboarding} />
      ) : !session ? (
        showSignUp ? (
          <SignUpScreen
            onSignedUp={() => setShowSignUp(false)}
            onBackToLogin={() => setShowSignUp(false)}
          />
        ) : (
          <LoginScreen onGoToSignUp={() => setShowSignUp(true)} />
        )
      ) : !unlocked ? (
        <LockScreen onUnlock={() => setUnlocked(true)} />
      ) : (
        <MainTabs />
      )}
    </NavigationContainer>
  );
}