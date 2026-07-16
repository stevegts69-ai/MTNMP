import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import PatientsStack from "./PatientsStack";
import MonitoringStack from "./MonitoringStack";
import ImagingScreen from "../screens/Imaging/ImagingScreen";
import MetabolicScreen from "../screens/Metabolic/MetabolicScreen";
import TreatmentScreen from "../screens/Treatment/TreatmentScreen";
import SyncStatusBanner from "../components/SyncStatusBanner";

export type MainTabParamList = {
  Patients: undefined;
  Imaging: undefined;
  Metabolic: undefined;
  Treatment: undefined;
  Monitoring: undefined;
};

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Patients: "people-outline",
  Imaging: "scan-outline",
  Metabolic: "pulse-outline",
  Treatment: "medkit-outline",
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
        <Tab.Screen name="Imaging" component={ImagingScreen} options={{ headerShown: true }} />
        <Tab.Screen name="Metabolic" component={MetabolicScreen} options={{ headerShown: true, title: "Metabolic" }} />
        <Tab.Screen name="Treatment" component={TreatmentScreen} options={{ headerShown: true }} />
        <Tab.Screen name="Monitoring" component={MonitoringStack} />
      </Tab.Navigator>
    </View>
  );
}