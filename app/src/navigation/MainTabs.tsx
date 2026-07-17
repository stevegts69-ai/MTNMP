import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import PatientsStack from "./PatientsStack";
import MonitoringStack from "./MonitoringStack";
import SyncStatusBanner from "../components/SyncStatusBanner";

// Imaging, Metabolic, and Treatment are deliberately NOT top-level tabs —
// that data is patient-specific, so those features live inside a patient's
// record (Patient Detail -> View Imaging / Metabolic Monitoring / Treatment
// Log), a decision made on Day 3. Only genuinely cross-patient views
// (Patients list, institution-wide Monitoring dashboard) belong here.
export type MainTabParamList = {
  Patients: undefined;
  Monitoring: undefined;
};

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Patients: "people-outline",
  Monitoring: "stats-chart-outline",
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  return (
    <View style={{ flex: 1 }}>
      <SyncStatusBanner />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: "#1E3A5F",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={TAB_ICONS[route.name as keyof MainTabParamList]}
              color={color}
              size={size}
            />
          ),
        })}
      >
        <Tab.Screen name="Patients" component={PatientsStack} />
        <Tab.Screen name="Monitoring" component={MonitoringStack} />
      </Tab.Navigator>
    </View>
  );
}