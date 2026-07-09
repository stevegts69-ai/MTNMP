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

export interface Profile {
  id: string;
  institution_id: string;
  full_name: string;
  role: UserRole;
  credential_number: string | null;
  credential_verified: boolean;
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
  ketosis_zone: KetosisZone | null;
  logged_at: string;
  logged_by: string | null;
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
  administered_by: string | null;
  notes: string | null;
  created_at: string;
}
