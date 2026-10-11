import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminApprovalScreen from "../screens/Admin/AdminApprovalScreen";
import InstitutionContentManagementScreen from "../screens/Admin/InstitutionContentManagementScreen";

export type AdminStackParamList = {
  AdminApproval: undefined;
  InstitutionContentManagement: undefined;
};

const Stack = createNativeStackNavigator<AdminStackParamList>();

export default function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerTitleStyle: { fontWeight: "600" } }}>
      <Stack.Screen
        name="AdminApproval"
        component={AdminApprovalScreen}
        options={{ title: "Approvals" }}
      />
      <Stack.Screen
        name="InstitutionContentManagement"
        component={InstitutionContentManagementScreen}
        options={{ title: "Institution Content" }}
      />
    </Stack.Navigator>
  );
}