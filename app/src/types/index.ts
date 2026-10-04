// Types mirror supabase/migrations/0001_initial_schema.sql — keep in sync.

export type UserRole =
  | "physician"
  | "radiologist"
  | "nuclear_med_physicist"
  | "admin";

export type ScanType = "PET_CT" | "SPECT" | "MRI" | "other";
export type FileType = "DICOM" | "PNG" | "JPEG";
export type KetosisZone = "green" | "yellow" | "red";
export type IsotopeType = "Lu177" | "Y90" | "I131" | "Ra223" | "other";
export type DoseUnit = "mCi" | "GBq";
export type DosimetryCalculationMethod = "MIRD" | "voxel-based" | "Monte Carlo" | "other";

export interface DosimetryImagingTimepoint {
  label: string;
  hours_post_injection: number;
}

export interface DosimetryOrganDose {
  organ: string;
  dose_gy: number;
  tolerance_limit_gy: number | null;
}

export interface DosimetryTumorDose {
  lesion_label: string;
  dose_gy: number;
  volume_cc: number | null;
}

export interface Profile {
  id: string;
  institution_id: string;
  full_name: string;
  role: UserRole;
  credential_number: string | null;
  credential_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Patient {
  id: string;
  institution_id: string;
  mrn: string;
  full_name: string;
  date_of_birth: string | null;
  sex: string | null;
  cancer_type: string | null;
  cancer_stage: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImagingRecord {
  id: string;
  patient_id: string;
  institution_id: string;
  scan_type: ScanType;
  storage_path: string;
  file_type: FileType;
  scan_date: string | null;
  comparison_group_id: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface MetabolicLog {
  id: string;
  patient_id: string;
  institution_id: string;
  glucose_mmol_l: number | null;
  ketones_mmol_l: number | null;
  platelets: number | null;
  hemoglobin: number | null;
  creatinine: number | null;
  egfr: number | null;
  wbc: number | null;
  ketosis_zone: KetosisZone | null;
  logged_at: string;
  logged_by: string | null;
}

export type LabType = "platelets" | "hemoglobin" | "creatinine" | "egfr" | "wbc";

export interface LabReferenceRange {
  lab_type: LabType;
  normal_low: number;
  normal_high: number;
  grade1_threshold: number;
  grade2_threshold: number;
  grade3_threshold: number;
  unit: string;
  abnormal_direction: "low" | "high";
}

export interface TreatmentLog {
  id: string;
  patient_id: string;
  institution_id: string;
  isotope: IsotopeType;
  target_receptor_or_tissue: string | null;
  dose_administered: number | null;
  dose_unit: DoseUnit | null;
  dosimetry_source: string | null;
  administered_date: string | null;
  cycle_number: number | null;
  total_planned_cycles: number | null;
  cycle_interval_days: number | null;
  administered_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface DischargeChecklistItem {
  item: string;
  checked: boolean;
  checked_by: string | null;
}

export interface DischargeChecklistTemplate {
  id: string;
  institution_id: string;
  isotope: IsotopeType;
  checklist_items: { item: string }[];
  updated_by: string | null;
  updated_at: string;
}

export interface DischargeInstructionTemplate {
  id: string;
  institution_id: string;
  isotope: IsotopeType;
  language: string;
  body_text: string;
  updated_by: string | null;
  updated_at: string;
}

export interface DischargeChecklist {
  id: string;
  patient_id: string;
  treatment_log_id: string;
  institution_id: string;
  isotope: IsotopeType;
  checklist_items: DischargeChecklistItem[];
  dose_rate_at_discharge: number | null;
  dose_rate_unit: string | null;
  completed_by: string;
  completed_at: string;
}

export interface ExposureLog {
  id: string;
  patient_id: string;
  treatment_log_id: string;
  institution_id: string;
  log_date: string;
  precaution_notes: string | null;
  entered_by: string | null;
  created_at: string;
}

export interface DosimetryRecord {
  id: string;
  patient_id: string;
  institution_id: string;
  cycle_number: number;
  isotope: IsotopeType;
  calculation_method: DosimetryCalculationMethod;
  imaging_timepoints: DosimetryImagingTimepoint[];
  organ_doses: DosimetryOrganDose[];
  tumor_doses: DosimetryTumorDose[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type ToxicityAssessmentType = "baseline" | "follow_up";

export interface ToxicityEvent {
  category: string;
  term: string;
  grade: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface ToxicityAssessment {
  id: string;
  patient_id: string;
  institution_id: string;
  assessment_type: ToxicityAssessmentType;
  cycle_number: number | null;
  ctcae_version: string;
  events: ToxicityEvent[];
  assessed_by: string | null;
  assessed_at: string;
}

export interface ToxicityAlert {
  id: string;
  patient_id: string;
  institution_id: string;
  assessment_id: string;
  event_summary: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export type LesionMeasurementMethod = "RECIST_1_1" | "PERCIST";
export type PercistCategory = "CMR" | "PMR" | "SMD" | "PMD";

export interface LesionMeasurement {
  id: string;
  patient_id: string;
  institution_id: string;
  lesion_label: string;
  is_target_lesion: boolean;
  timepoint_date: string;
  measurement_mm: number | null;
  suv_max: number | null;
  method: LesionMeasurementMethod;
  is_new_lesion: boolean;
  manual_percist_category: PercistCategory | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}
