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
import TreatmentLogDetailScreen from "../screens/Treatment/TreatmentLogDetailScreen";
import NewOrganDoseScreen from "../screens/Treatment/NewOrganDoseScreen";
import DosimetryHistoryScreen from "../screens/Dosimetry/DosimetryHistoryScreen";
import DosimetryFormScreen from "../screens/Dosimetry/DosimetryFormScreen";
import ToxicityAssessmentScreen from "../screens/Monitoring/ToxicityAssessmentScreen";
import ToxicityHistoryScreen from "../screens/Monitoring/ToxicityHistoryScreen";
import TumorBoardReportScreen from "../screens/Monitoring/TumorBoardReportScreen";
import ResponseAssessmentScreen from "../screens/Monitoring/ResponseAssessmentScreen";
import CycleScheduleScreen from "../screens/Treatment/CycleScheduleScreen";
import DischargeChecklistScreen from "../screens/Treatment/DischargeChecklistScreen";
import PatientInstructionsScreen from "../screens/Treatment/PatientInstructionsScreen";

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
  TreatmentLogDetail: { treatmentLogId: string };
  NewOrganDose: { treatmentLogId: string };
  DosimetryHistory: { patientId: string };
  DosimetryForm: { patientId: string };
  ToxicityAssessment: { patientId: string };
  ToxicityHistory: { patientId: string };
  TumorBoardReport: { patientId: string };
  ResponseAssessment: { patientId: string };
  CycleSchedule: undefined;
  DischargeChecklist: { patientId: string };
  PatientInstructions: { patientId: string };
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
      <Stack.Screen name="TreatmentLogDetail" component={TreatmentLogDetailScreen} options={{ title: "Treatment Detail" }} />
      <Stack.Screen name="NewOrganDose" component={NewOrganDoseScreen} options={{ title: "Log Organ Dose" }} />
      <Stack.Screen name="DosimetryHistory" component={DosimetryHistoryScreen} options={{ title: "Dosimetry History" }} />
      <Stack.Screen name="DosimetryForm" component={DosimetryFormScreen} options={{ title: "Record Dosimetry" }} />
      <Stack.Screen name="ToxicityAssessment" component={ToxicityAssessmentScreen} options={{ title: "Toxicity Assessment" }} />
      <Stack.Screen name="ToxicityHistory" component={ToxicityHistoryScreen} options={{ title: "Toxicity History" }} />
      <Stack.Screen name="TumorBoardReport" component={TumorBoardReportScreen} options={{ title: "Tumor Board Report" }} />
      <Stack.Screen name="ResponseAssessment" component={ResponseAssessmentScreen} options={{ title: "Response Assessment" }} />
      <Stack.Screen name="CycleSchedule" component={CycleScheduleScreen} options={{ title: "Institution Cycle Calendar" }} />
      <Stack.Screen name="DischargeChecklist" component={DischargeChecklistScreen} options={{ title: "Discharge Checklist" }} />
      <Stack.Screen name="PatientInstructions" component={PatientInstructionsScreen} options={{ title: "Patient Instructions" }} />
    </Stack.Navigator>
  );
}