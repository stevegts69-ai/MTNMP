import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PatientListScreen from "../screens/Patients/PatientListScreen";
import NewPatientScreen from "../screens/Patients/NewPatientScreen";
import PatientDetailScreen from "../screens/Patients/PatientDetailScreen";
import PatientImagingScreen from "../screens/Imaging/PatientImagingScreen";
import NewImagingScreen from "../screens/Imaging/NewImagingScreen";

export type PatientsStackParamList = {
  PatientList: undefined;
  NewPatient: undefined;
  PatientDetail: { patientId: string };
  PatientImaging: { patientId: string };
  NewImaging: { patientId: string };
};

const Stack = createNativeStackNavigator<PatientsStackParamList>();

export default function PatientsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerTitleStyle: { fontWeight: "600" } }}>
      <Stack.Screen name="PatientList" component={PatientListScreen} options={{ title: "Patients" }} />
      <Stack.Screen name="NewPatient" component={NewPatientScreen} options={{ title: "New Patient" }} />
      <Stack.Screen name="PatientDetail" component={PatientDetailScreen} options={{ title: "Patient" }} />
      <Stack.Screen name="PatientImaging" component={PatientImagingScreen} options={{ title: "Imaging" }} />
      <Stack.Screen name="NewImaging" component={NewImagingScreen} options={{ title: "Upload Scan" }} />
    </Stack.Navigator>
  );
}