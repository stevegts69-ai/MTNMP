import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import PatientsStack from "./PatientsStack";
import MonitoringStack from "./MonitoringStack";
import SyncStatusBanner from "../components/SyncStatusBanner";
import { useAuthStore } from "../store/authStore";
import AdminApprovalScreen from "../screens/Admin/AdminApprovalScreen";

// Imaging, Metabolic, and Treatment are deliberately NOT top-level tabs —
// that data is patient-specific, so those features live inside a patient's
// record (Patient Detail -> View Imaging / Metabolic Monitoring / Treatment
// Log), a decision made on Day 3. Only genuinely cross-patient views
// (Patients list, institution-wide Monitoring dashboard, Admin approval)
// belong here.
export type MainTabParamList = {
  Patients: undefined;
  Monitoring: undefined;
  Admin: undefined;
};

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Patients: "people-outline",
  Monitoring: "stats-chart-outline",
  Admin: "shield-checkmark-outline",
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  const profile = useAuthStore((s) => s.profile);
  const isAdmin = profile?.role === "admin";

  return (
    <View style={{ flex: 1 }}>
      <SyncStatusBanner />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: route.name === "Admin",
          title: route.name === "Admin" ? "Approvals" : undefined,
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
        {isAdmin ? <Tab.Screen name="Admin" component={AdminApprovalScreen} /> : null}
      </Tab.Navigator>
    </View>
  );
}