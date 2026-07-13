import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PatientListScreen from "../screens/Patients/PatientListScreen";
import NewPatientScreen from "../screens/Patients/NewPatientScreen";
import PatientDetailScreen from "../screens/Patients/PatientDetailScreen";
import PatientImagingScreen from "../screens/Imaging/PatientImagingScreen";
import NewImagingScreen from "../screens/Imaging/NewImagingScreen";
import PatientMetabolicScreen from "../screens/Metabolic/PatientMetabolicScreen";
import NewMetabolicLogScreen from "../screens/Metabolic/NewMetabolicLogScreen";
import PatientTreatmentScreen from "../screens/Treatment/PatientTreatmentScreen";
import NewTreatmentLogScreen from "../screens/Treatment/NewTreatmentLogScreen";

export type PatientsStackParamList = {
  PatientList: undefined;
  NewPatient: undefined;
  PatientDetail: { patientId: string };
  PatientImaging: { patientId: string };
  NewImaging: { patientId: string };
  PatientMetabolic: { patientId: string };
  NewMetabolicLog: { patientId: string };
  PatientTreatment: { patientId: string };
  NewTreatmentLog: { patientId: string };
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
      <Stack.Screen name="PatientMetabolic" component={PatientMetabolicScreen} options={{ title: "Metabolic Monitoring" }} />
      <Stack.Screen name="NewMetabolicLog" component={NewMetabolicLogScreen} options={{ title: "Log Reading" }} />
      <Stack.Screen name="PatientTreatment" component={PatientTreatmentScreen} options={{ title: "Treatment Log" }} />
      <Stack.Screen name="NewTreatmentLog" component={NewTreatmentLogScreen} options={{ title: "Log Treatment" }} />
    </Stack.Navigator>
  );
}