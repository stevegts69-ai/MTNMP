import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import PatientListScreen from "../screens/Patients/PatientListScreen";
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
        headerTitleStyle: { fontWeight: "600" },
        tabBarActiveTintColor: "#1E3A5F",
        tabBarInactiveTintColor: "#9CA3AF",
      }}
    >
      <Tab.Screen name="Patients" component={PatientListScreen} />
      <Tab.Screen name="Imaging" component={ImagingScreen} />
      <Tab.Screen name="Metabolic" component={MetabolicScreen} options={{ title: "Metabolic" }} />
      <Tab.Screen name="Treatment" component={TreatmentScreen} />
      <Tab.Screen name="Monitoring" component={MonitoringScreen} />
    </Tab.Navigator>
  );
}
