# Product Requirements Document
## Metabolic Nuclear Medicine Platform — MVP

**Status:** Draft — living document, updated during build
**Version:** 0.1
**Last updated:** Day 1 of build

---

## 1. Product Summary

A clinical support and record-keeping mobile app for physicians (oncologists, nuclear medicine physicians, radiologists) that supports **metabolic monitoring alongside established, validated targeted radionuclide therapy** (e.g., Lu-177 PRRT, I-131, Y-90, Ra-223).

**The app does not diagnose, calculate doses, or recommend treatment.** It is a structured record-keeping, tracking, and monitoring tool used by qualified physicians who make all clinical decisions independently, using their own training, judgment, and whatever diagnostic and treatment regimens they determine appropriate for the patient.

### 1.1 Product thesis — scientific backbone

This product is differentiated from general oncology management software by a specific, focused scientific thesis, grounded in established literature rather than a fringe or anecdotal position:

1. **Metabolic reprogramming (the Warburg effect) is settled, clinically exploitable science.** Cancer's shift toward glycolytic metabolism is not in scientific dispute — it's a recognized hallmark of cancer biology.
2. **Cancer's origin is most consistent with mutation-driven dysregulation — and that dysregulation expresses itself through metabolism.** This is the core value proposition of the product: you don't need to resolve the debate over what originally causes a cell to become malignant to exploit the fact that, once it is, its altered metabolic behavior becomes a measurable, targetable lever. Metabolic targeting works as leverage *on the expression of malignancy*, independent of the origin question.
3. **Starvation/ketosis has a differential effect on cancer vs. normal cell stress resistance** — a real, published mechanism (closely paralleled by fasting-mimicking diet research), not a claim that starvation affects all cells equally.
4. **The correct clinical role for this is adjunctive** — used alongside established, targeted nuclear medicine (PRRT-style radionuclide therapy, using validated isotopes and targeting mechanisms — not experimental/unvalidated glucose-glutamine-only agents) — to reduce inflammation and acidification and create a metabolic environment less permissive for tumor growth, while the targeted nuclear medicine does the primary treatment work.

### 1.2 What this product explicitly is NOT
- Not a general oncology management platform — it is a focused tool for metabolic terrain optimization alongside established targeted nuclear medicine
- Not a standalone diagnostic tool — imaging and metabolic data support the physician's own diagnostic process, not a substitute for it
- Not a dose calculator (all dosing is determined by qualified nuclear medicine physicists off-app; the app only logs what was administered)
- Not a treatment recommendation engine
- Not a replacement for whatever other treatment regimens a physician determines clinically appropriate — it is the physician's prerogative to decide the full diagnostic and treatment approach; this app supports the metabolic and nuclear medicine component of that approach, not the whole of it

---

## 2. Target Users

| Role | Use in app |
|---|---|
| Physician / Oncologist | Full read/write on patients, metabolic logs, treatment logs |
| Nuclear Medicine Physician | Full read/write, primary user of treatment logging |
| Radiologist | Imaging upload/review, comparison annotations |
| Nuclear Medicine Physicist | Reference role — dosimetry work happens off-app; may consult treatment logs |
| Admin | Institution setup, credential verification, audit log access |

All users belong to an **institution** (hospital/clinic) and share institution-wide visibility on patient records (not siloed per-doctor), reflecting real multi-specialist care coordination.

---

## 3. Core Modules & Requirements

### 3.1 Patient Management
**User story:** As a physician, I want to create and search patient records so I can track their care across imaging, metabolic, and treatment data in one place.

**Acceptance criteria:**
- Physician can create a patient record with MRN, name, DOB, sex, cancer type, stage
- MRN is unique per institution (enforced at DB level)
- Physician can search/filter patients by name, MRN, or cancer type
- Only credential-verified users can create/edit patient records
- All institution members can view patient records (shared care model)

### 3.2 Imaging Module
**User story:** As a physician, I want to upload and review a patient's PET/CT or other scans, and compare pre/post-treatment imaging, so I can track how the disease is responding over time — as one input among others in my clinical assessment.

**Acceptance criteria:**
- Physician can upload DICOM or PNG/JPEG files, tagged with scan type and date
- PNG/JPEG render inline; DICOM files are stored and downloadable but shown as a placeholder ("view on PACS workstation") — no in-app DICOM pixel rendering in MVP
- Scans can be grouped (`comparison_group_id`) to support side-by-side pre/post viewing
- No AI-based analysis, segmentation, or automated detection is presented to the user
- No language in the UI implies imaging alone is sufficient for definitive diagnosis

### 3.3 Metabolic Monitoring
**User story:** As a physician, I want to log and track a patient's glucose/ketone levels over time, so I can assess their metabolic state as adjunctive context for their care.

**Acceptance criteria:**
- Physician can log glucose (mmol/L) and ketone (mmol/L) readings with timestamp
- App computes a ketosis zone (green/yellow/red) from the entered values using a simple, disclosed threshold — displayed as a descriptive indicator, not a clinical recommendation
- Weekly trend chart displays glucose/ketone history
- Data can be exported to PDF for the patient's chart/records

### 3.4 Treatment Log
**User story:** As a physician, I want to record what radionuclide treatment was administered — including dose, isotope, and target — determined through my own clinical process, so I have a complete, auditable treatment history for each patient.

**Acceptance criteria:**
- Physician can log: isotope (Lu-177, Y-90, I-131, Ra-223, other), target receptor/tissue, dose administered + unit, dosimetry source reference (e.g., physicist name/institution record), administration date, notes
- **The app performs no dose calculation.** Dose fields are physician/physicist-entered values only.
- Dosimetry source field requires a reference (free text) — the app does not accept an unattributed dose value without a source note, reinforcing that this is a *record*, not a *recommendation*.

### 3.5 Monitoring Dashboard
**User story:** As a physician, I want to see all my active treatment cases, upcoming imaging dates, and treatment response at a glance, so I can manage my caseload efficiently.

**Acceptance criteria:**
- Dashboard lists active treatment logs with days-elapsed and next-imaging-due-date
- Pre/post imaging comparison view pulls from linked `comparison_group_id` scans
- Physician can export a treatment summary as PDF

### 3.6 Safety & Compliance
**User story:** As a physician/admin, I want assurance that patient data is secure, access is logged, and only credentialed staff can act on records, so the platform meets clinical data-handling standards.

**Acceptance criteria:**
- Biometric authentication (FaceID/TouchID) required to open the app
- Row-level security enforces institution-scoped access on all clinical tables
- Every view/create/update/delete/export action is recorded in an append-only audit log
- Unverified credentials block write access to clinical data (read-only until admin verifies)
- Organ dose values (physician/physicist-entered) can be compared against a reference threshold, surfacing a flag if exceeded — a threshold *comparison*, not an app-generated safety judgment

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Offline support** | Metabolic logs and treatment log entries can be created offline and queued for sync; reads served from cache when offline |
| **Data security** | TLS in transit, AES-256 at rest (Supabase default), RLS on all clinical tables |
| **Auth** | OAuth2 + biometric local auth; 2FA planned for institution admin accounts |
| **Compliance posture** | Aligned with HIPAA/GDPR data-handling principles; positioned for engagement with PPB (Kenya) / NAFDAC (Nigeria) as a clinical support/record-keeping tool — classification to be confirmed directly with regulators before wide deployment |
| **Platform** | Android APK first (EAS Build); iOS/web/desktop deferred to post-MVP |
| **Performance target** | Usable on mid-range Android devices common in target hospital markets — avoid heavy client-side processing (reinforces the DICOM-not-rendered-in-app decision) |

---

## 5. Explicitly Out of Scope (MVP)

- Automated radiopharmaceutical dose calculation
- AI-based tumor detection, segmentation, or SUV extraction
- Any framing suggesting imaging alone is sufficient for definitive diagnosis
- "Success story" / outcome testimonial content
- In-app DICOM pixel rendering (deferred to Orthanc integration, Phase 2)
- PACS/RIS live integration (deferred to Phase 2)
- iOS, web, desktop builds (deferred, post-MVP)
- Push notifications (deferred, post-MVP)

---

## 6. Regulatory Positioning (draft — confirm with counsel/regulators before launch)

- Positioned as a **clinical record-keeping and monitoring support tool**, not a diagnostic or dosing device
- No clinical decision is generated, calculated, or recommended by the app — all values are physician/physicist-entered
- This positioning should be validated directly with PPB (Kenya) and/or NAFDAC (Nigeria) before any hospital pilot, as software that touches treatment records may still draw regulatory scrutiny depending on final feature implementation — the "no calculation" design choice is intended to reduce, not eliminate, this scrutiny

---

## 7. UI Copy Convention (applies to all screens, Day 2 onward)

- Do not use the words "biopsy," "chemotherapy"/"chemo," "surgery," or "radiation" anywhere in app UI text (labels, placeholders, help text, alerts, exported PDFs).
- Where a screen needs to reference the physician's broader care approach beyond this app's scope, use vague, physician's-prerogative phrasing — e.g., "other treatment regimens," "your broader clinical approach," "the diagnostic pathway you determine appropriate" — consistent with PRD Section 1.
- This is a wording convention only. It does not change what the app actually claims: imaging/metabolic data must still never be presented as sufficient on its own for definitive diagnosis, and dose fields must still require a dosimetry source rather than accept an unattributed value. Screens should be checked against both the wording rule and this underlying substance during review — vague language must not drift into implying the app's data is diagnostically or therapeutically sufficient on its own.

---

## 8. Open Questions (tracked, not blocking build)
- Conflict resolution policy for offline sync writes (last-write-wins vs. flag-for-review) — decide during Day 9
- Long-term imaging rendering path (Orthanc integration timeline)
- Formal regulatory engagement timeline with PPB/NAFDAC ahead of hospital pilot
