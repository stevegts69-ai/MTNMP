# 10-Day Build Plan — Metabolic-Targeted Nuclear Medicine Platform

Scope basis: SCHEMA_DESIGN.md (locked). No automated dosing/diagnosis — record-keeping and monitoring tool, adjunctive to physician-directed care.

## Day 1 — Setup & Core Architecture
- Initialize Expo project
- Set up Supabase (auth, database, storage) — apply `0001_initial_schema.sql`
- Configure navigation (tabs: Patients, Imaging, Metabolic, Treatment, Monitoring)
- Basic screens: login, patient list shell
- *(parallel, background)* Start PRD draft using decisions already locked in this doc + SCHEMA_DESIGN.md

## Day 2 — Patient Management
- Patient registration form
- Patient profile screen
- Patient list with search/filter
- Validation & error handling
- RLS smoke test: confirm institution-scoped access works end-to-end

## Day 3 — Imaging Module (simplified for MVP)
- Upload to Supabase Storage (DICOM or PNG/JPEG)
- Inline viewer for PNG/JPEG only (standard `Image` component)
- DICOM files: stored + downloadable, shown as placeholder ("DICOM file — view on PACS workstation"), not rendered
- `comparison_group_id` wiring for pre/post scan pairing (UI can come later; data linking now)

## Day 4 — Metabolic Monitoring
- Glucose/ketone input fields
- Ketosis zone calculator (green/yellow/red — simple range logic, not a clinical claim)
- Weekly trend chart (Recharts)
- Export to PDF

## Day 5 — Treatment Log
- Isotope selection (Lu177, Y90, I131, Ra223, other)
- Tumor/target tissue field
- Dose *entry* (from off-app dosimetry) + dosimetry source reference field
- Notes
- Save to Supabase — no calculation engine

## Day 6 — Monitoring Dashboard
- List of active treatment logs
- Progress indicators (days elapsed, next imaging due date)
- Pre/post imaging comparison view (uses Day 3's comparison_group_id)
- Export treatment summary (PDF)

## Day 7 — Safety Alerts & Audit Logging
- Organ dose log entry + threshold comparison display (doctor-entered values vs. reference thresholds — comparison only, not a recommendation)
- Audit log wiring across all create/update/view actions
- Confirm audit_logs RLS (admin-only read, append-only insert)

## Day 8 — Biometric Auth & RLS Hardening
- FaceID/TouchID via Expo LocalAuthentication
- Cross-role RLS testing (physician, radiologist, nuclear_med_physicist, admin)
- Credential-verification gate testing (unverified accounts blocked from writes)

## Day 9 — Offline Mode
- React Query cache for reads
- Queued writes for offline metabolic logs / treatment log entries
- Conflict handling on sync (last-write-wins vs. flag-for-review — decide during build)
- Loading states, error handling across all screens

## Day 10 — Build & Deploy
- EAS Build → generate APK
- Test on physical device
- Fix critical bugs
- Prepare deployment package
- Document setup for hospital IT (includes Supabase project setup, RLS overview, admin bootstrapping steps)

## Explicitly deferred to Phase 2
- Orthanc integration for true DICOM rendering + PACS/RIS integration
- Automated dose calculation (requires certified nuclear medicine physicist sign-off on methodology — not an app feature)
- AI-based imaging analysis
- Push notifications
