# Metabolic-Targeted Nuclear Medicine Platform — Schema Design

## Locked-in architecture decisions
- **Storage:** Supabase Storage (S3-compatible, RLS-integrated, signed URLs)
- **Multi-tenancy:** Institution-based from day one (`institutions` table + `institution_id` FK across records)
- **Access model:** Institution-wide shared access (not per-doctor silo) — enables care team coordination. Every read/write individually logged in `audit_logs` for accountability.
- **Scope:** Record-keeping and monitoring tool. No automated dosing, no automated diagnosis. All clinical decisions are made by the physician off-app (via proper dosimetry/diagnostic workflow); the app logs and tracks those decisions.

## Tables

### institutions
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| name | text | |
| country | text | |
| regulatory_body | text | e.g. "PPB - Kenya", "NAFDAC - Nigeria" |
| created_at | timestamptz | |

### profiles (extends auth.users)
| column | type | notes |
|---|---|---|
| id | uuid, PK, FK auth.users | |
| institution_id | uuid, FK institutions | |
| full_name | text | |
| role | enum(physician, radiologist, nuclear_med_physicist, admin) | |
| credential_number | text | |
| credential_verified | bool | default false |
| created_at | timestamptz | |

### patients
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| institution_id | uuid, FK institutions | |
| mrn | text | unique per institution |
| full_name | text | |
| date_of_birth | date | |
| sex | text | |
| cancer_type | text | |
| cancer_stage | text | |
| created_by | uuid, FK profiles | |
| created_at / updated_at | timestamptz | |

### imaging_records
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| patient_id | uuid, FK patients | |
| institution_id | uuid, FK institutions | denormalized for RLS speed |
| scan_type | enum(PET_CT, SPECT, MRI, other) | |
| storage_path | text | Supabase Storage object path |
| file_type | enum(DICOM, PNG, JPEG) | |
| scan_date | date | |
| comparison_group_id | uuid, nullable | links pre/post scans of same lesion |
| notes | text | |
| uploaded_by | uuid, FK profiles | |
| created_at | timestamptz | |

### metabolic_logs
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| patient_id | uuid, FK patients | |
| institution_id | uuid, FK institutions | |
| glucose_mmol_l | numeric | |
| ketones_mmol_l | numeric | |
| ketosis_zone | enum(green, yellow, red) | computed client/server side from thresholds, not a clinical diagnosis |
| logged_at | timestamptz | |
| logged_by | uuid, FK profiles | |

### treatment_logs
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| patient_id | uuid, FK patients | |
| institution_id | uuid, FK institutions | |
| isotope | enum(Lu177, Y90, I131, Ra223, other) | |
| target_receptor_or_tissue | text | e.g. "somatostatin receptor", "thyroid" |
| dose_administered | numeric | doctor-entered, from off-app dosimetry |
| dose_unit | enum(mCi, GBq) | |
| dosimetry_source | text | reference to physicist/institution record — provenance, not calculation |
| administered_date | date | |
| administered_by | uuid, FK profiles | |
| notes | text | |
| created_at | timestamptz | |

### organ_dose_logs
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| treatment_log_id | uuid, FK treatment_logs | |
| organ | text | e.g. "liver", "kidney" |
| dose_value | numeric | doctor-entered |
| dose_limit_reference | numeric | nullable, for threshold comparison only |
| recorded_at | timestamptz | |

### treatment_monitoring
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| treatment_log_id | uuid, FK treatment_logs | |
| pre_imaging_id | uuid, FK imaging_records, nullable | |
| post_imaging_id | uuid, FK imaging_records, nullable | |
| next_imaging_due_date | date | |
| response_notes | text | physician's own assessment — free text, not app-generated |
| created_by | uuid, FK profiles | |
| created_at | timestamptz | |

### safety_alerts
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| treatment_log_id | uuid, FK treatment_logs | |
| alert_type | text | e.g. "organ_dose_threshold" |
| threshold_value | numeric | configurable, not app-prescribed |
| entered_value | numeric | |
| triggered_at | timestamptz | |
| acknowledged_by | uuid, FK profiles, nullable | |
| acknowledged_at | timestamptz, nullable | |

### audit_logs
| column | type | notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK profiles | |
| institution_id | uuid, FK institutions | |
| action | enum(view, create, update, delete, export) | |
| table_name | text | |
| record_id | uuid | |
| ip_address | text | |
| timestamp | timestamptz | |

## RLS strategy (to implement in migration)
- All clinical tables (`patients`, `imaging_records`, `metabolic_logs`, `treatment_logs`, `organ_dose_logs`, `treatment_monitoring`, `safety_alerts`) filtered by `institution_id = auth.jwt() -> institution_id`.
- `audit_logs` insert-only from client side (no update/delete via client — append-only for integrity); read access restricted to `admin` role.
- `profiles.credential_verified` gates write access to clinical tables — unverified accounts get read-only or no access until admin approves.

## Imaging rendering strategy (MVP)
- **Storage:** Supabase Storage handles both DICOM and PNG/JPEG uploads as-is — no server-side conversion for MVP.
- **Rendering:** App only renders PNG/JPEG inline (standard `Image` component). DICOM files are stored and downloadable/shareable, but shown as a placeholder ("DICOM file — view on PACS workstation") rather than rendered in-app.
- **Rationale:** Matches real clinical practice — diagnostic-grade DICOM viewing is expected to happen on a calibrated radiology workstation, not a phone screen, so this isn't a compromise on clinical validity. Many scanners/PACS systems already export a quick-look JPEG alongside the DICOM, which covers the in-app preview use case.
- **Phase 2:** Orthanc (self-hosted, DICOM-native, open-source PACS server) can be introduced later for server-side DICOM → PNG conversion and eventually full PACS/RIS integration, matching the original blueprint's Phase 2 "Integration with hospital systems" goal. No schema changes needed to add this later — `imaging_records.storage_path` and `file_type` already accommodate the swap.

## Explicitly out of scope (per prior discussion)
- No automated dose calculation engine.
- No AI-based tumor segmentation/detection presented as diagnostic.
- No "success stories" / outcome testimonial content.
- No claim that imaging replaces biopsy.
- No in-app DICOM pixel rendering for MVP (see Imaging rendering strategy above).
