import React, { useEffect, useRef, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { View, ActivityIndicator, AppState, AppStateStatus } from "react-native";
import { useAuthStore } from "../store/authStore";
import LoginScreen from "../screens/Auth/LoginScreen";
import LockScreen from "../screens/Auth/LockScreen";
import MainTabs from "./MainTabs";

export default function RootNavigator() {
  const { session, loading, initialize } = useAuthStore();
  const [unlocked, setUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initialize();
  }, [initialize]);

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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-clinical-bg">
        <ActivityIndicator color="#1E3A5F" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!session ? (
        <LoginScreen />
      ) : !unlocked ? (
        <LockScreen onUnlock={() => setUnlocked(true)} />
      ) : (
        <MainTabs />
      )}
    </NavigationContainer>
  );
}