import * as Sentry from "@sentry/react-native";

Sentry.init({
  // 1. DSN loaded from environment variables
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  
  // 2. Explicitly force PII collection OFF for medical data compliance
  sendDefaultPii: false, 
  
  // 3. Keep the development configurations from the wizard
  enableLogs: true,
  tracesSampleRate: 1.0, 
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.mobileReplayIntegration()],

  // 4. Client-side scrubbing before data ever leaves the mobile device
  beforeSend(event) {
    if (event.exception && event.exception.values) {
      event.exception.values.forEach((exception) => {
        if (exception.value) {
          exception.value = exception.value
            .replace(/\b\d{6,9}\b/g, "[REDACTED_MRN]")
            .replace(/(patient|name|mrn|ssn)\s*=\s*[^&\s]+/gi, "$1=[REDACTED]");
        }
      });
    }
    
    if (event.extra) {
      delete event.extra.patientData;
      delete event.extra.userMedicalRecords;
    }

    return event;
  },
});

import "./global.css";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import RootNavigator from "./src/navigation/RootNavigator";

function App() {
  return (
    <SafeAreaProvider>
      <RootNavigator />
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
