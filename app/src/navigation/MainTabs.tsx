import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import PatientsStack from "./PatientsStack";
import ImagingScreen from "../screens/Imaging/ImagingScreen";
import MetabolicScreen from "../screens/Metabolic/MetabolicScreen";
import TreatmentScreen from "../screens/Treatment/TreatmentScreen";
import MonitoringScreen from "../screens/Monitoring/MonitoringScreen";

export type MainTabParamList = {
  Patients: undefined;
  Imaging: undefined;
  Metabolic: undefined;
  Treatment: undefined;
  Monitoring: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1E3A5F",
        tabBarInactiveTintColor: "#9CA3AF",
      }}
    >
      <Tab.Screen name="Patients" component={PatientsStack} />
      <Tab.Screen name="Imaging" component={ImagingScreen} options={{ headerShown: true }} />
      <Tab.Screen name="Metabolic" component={MetabolicScreen} options={{ headerShown: true, title: "Metabolic" }} />
      <Tab.Screen name="Treatment" component={TreatmentScreen} options={{ headerShown: true }} />
      <Tab.Screen name="Monitoring" component={MonitoringScreen} options={{ headerShown: true }} />
    </Tab.Navigator>
  );
}