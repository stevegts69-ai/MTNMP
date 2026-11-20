import React, { useEffect } from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import PatientsStack from "./PatientsStack";
import MonitoringStack from "./MonitoringStack";
import SyncStatusBanner from "../components/SyncStatusBanner";
import { useAuthStore } from "../store/authStore";
import AdminStack from "./AdminStack";
import ChatStack from "./ChatStack";
import { useChatStore } from "../store/chatStore";

// Imaging, Metabolic, and Treatment are deliberately NOT top-level tabs —
// that data is patient-specific, so those features live inside a patient's
// record (Patient Detail -> View Imaging / Metabolic Monitoring / Treatment
// Log), a decision made on Day 3. Only genuinely cross-patient views
// (Patients list, institution-wide Monitoring dashboard, Admin approval)
// belong here.
export type MainTabParamList = {
  Patients: undefined;
  Chat: undefined;
  Monitoring: undefined;
  Admin: undefined;
};

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Patients: "people-outline",
  Chat: "chatbubbles-outline",
  Monitoring: "stats-chart-outline",
  Admin: "shield-checkmark-outline",
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  const profile = useAuthStore((s) => s.profile);
  const unreadByChannel = useChatStore((s) => s.unreadByChannel);
  const startUnreadTracking = useChatStore((s) => s.startUnreadTracking);
  const stopUnreadTracking = useChatStore((s) => s.stopUnreadTracking);
  const isAdmin = profile?.role === "admin" && profile.credential_verified;
  const totalUnread = Object.values(unreadByChannel).reduce((total, count) => total + count, 0);

  useEffect(() => {
    if (profile) void startUnreadTracking(profile);
    else stopUnreadTracking();
    return () => stopUnreadTracking();
  }, [profile?.id, profile?.institution_id, profile?.credential_verified, profile?.is_active, startUnreadTracking, stopUnreadTracking]);

  return (
    <View style={{ flex: 1 }}>
      <SyncStatusBanner />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: route.name === "Admin",
          title: route.name === "Admin" ? "Approvals" : undefined,
          tabBarActiveTintColor: "#1E3A5F",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarBadge: route.name === "Chat" && totalUnread > 0
            ? totalUnread > 99 ? "99+" : totalUnread
            : undefined,
          tabBarBadgeStyle: { backgroundColor: "#047857", fontSize: 10 },
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
        <Tab.Screen name="Chat" component={ChatStack} />
        <Tab.Screen name="Monitoring" component={MonitoringStack} />
        {isAdmin ? (
          <Tab.Screen
            name="Admin"
            component={AdminStack}
            options={{ headerShown: false, title: "Admin" }}
          />
        ) : null}
      </Tab.Navigator>
    </View>
  );
}