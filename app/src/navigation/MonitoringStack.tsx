import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MonitoringDashboardScreen from "../screens/Monitoring/MonitoringDashboardScreen";
import TreatmentMonitoringDetailScreen from "../screens/Monitoring/TreatmentMonitoringDetailScreen";

export type MonitoringStackParamList = {
  MonitoringDashboard: undefined;
  TreatmentMonitoringDetail: { treatmentLogId: string; patientId: string };
};

const Stack = createNativeStackNavigator<MonitoringStackParamList>();

export default function MonitoringStack() {
  return (
    <Stack.Navigator screenOptions={{ headerTitleStyle: { fontWeight: "600" } }}>
      <Stack.Screen
        name="MonitoringDashboard"
        component={MonitoringDashboardScreen}
        options={{ title: "Monitoring" }}
      />
      <Stack.Screen
        name="TreatmentMonitoringDetail"
        component={TreatmentMonitoringDetailScreen}
        options={{ title: "Treatment Progress" }}
      />
    </Stack.Navigator>
  );
}