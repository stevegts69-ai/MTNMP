# Product Requirements Document
## Metabolic Nuclear Medicine Platform — MVP

**Status:** MVP build complete (Days 1-10) — Android APK in first build via EAS
**Version:** 1.0
**Last updated:** Day 10 of build

---

## 1. Product Summary

A clinical support and record-keeping mobile app for physicians (oncologists, nuclear medicine physicians, radiologists) that supports **metabolic monitoring alongside established, validated targeted radionuclide therapy** (e.g., Lu-177 PRRT, I-131, Y-90, Ra-223).

**The app does not diagnose, calculate doses, or recommend treatment.** It is a structured record-keeping, tracking, and monitoring tool used by qualified physicians who make all clinical decisions independently, using their own training, judgment, and whatever diagnostic and treatment regimens they determine appropriate for the patient.

### 1.1 Product thesis — scientific backbone

This product is differentiated from general oncology management software by a specific, focused scientific thesis, grounded in established literature rather than a fringe or anecdotal position:

1. **Metabolic reprogramming (the Warburg effect) is settled, clinically exploitable science.** Cancer's shift toward glycolytic metabolism is not in scientific dispute — it's a recognized hallmark of cancer biology.
2. **Cancer's origin is most consistent with mutation-driven dysregulation — and that dysregulation expresses itself through metabolism.** This is the core value proposition of the product: you don't need to resolve the debate over what originally causes a cell to become malignant to exploit the fact that, once it is, its altered metabolic behavior becomes a measurable, targetable lever. Metabolic targeting works as leverage *on the expression of malignancy*, independent of the origin question.
3. **Starvation/ketosis has a differential effect on cancer vs. normal cell stress resistance** — a real, published mechanism (closely paralleled by fasting-mimicking diet research), not a claim that starvation affects all cells equally.
4. **The correct clinical role for this is adjunctive** — used alongside established, targeted nuclear medicine (PRRT-style radionuclide therapy, using validated isotopes and targeting mechanisms) — to reduce inflammation and acidification and create a metabolic environment less permissive for tumor growth, while the targeted nuclear medicine does the primary treatment work.

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

### 3.1 Patient Management — ✅ Built
**User story:** As a physician, I want to create and search patient records so I can track their care across imaging, metabolic, and treatment data in one place.

**Acceptance criteria:**
- Physician can create a patient record with MRN, name, DOB, sex, cancer type, stage
- MRN is unique per institution (enforced at DB level)
- Physician can search/filter patients by name, MRN, or cancer type
- Only credential-verified users can create/edit patient records
- All institution members can view patient records (shared care model)

### 3.2 Imaging Module — ✅ Built
**User story:** As a physician, I want to upload and review a patient's PET/CT or other scans, and compare pre/post-treatment imaging, so I can track how the disease is responding over time — as one input among others in my clinical assessment.

**As built:**
- Upload via device photo library (PNG/JPEG) or general file picker (DICOM/other), scoped per-patient
- PNG/JPEG render inline; other file types (including DICOM) show a placeholder ("DICOM file — view on PACS workstation") — no in-app DICOM pixel rendering
- Storage bucket restricted to specific MIME types and file size (50MB), private with signed-URL access scoped by institution via Storage RLS policies
- Pre/post scan comparison built as part of the Monitoring Dashboard (Section 3.5), not the Imaging module itself — a physician selects two of a patient's existing scans as "pre" and "post" from the Treatment Monitoring detail screen
- No AI-based analysis, segmentation, or automated detection is presented to the user
- No language in the UI implies imaging alone is sufficient for definitive diagnosis

### 3.3 Metabolic Monitoring — ✅ Built
**User story:** As a physician, I want to log and track a patient's glucose/ketone levels over time, so I can assess their metabolic state as adjunctive context for their care.

**As built:**
- Physician logs glucose (mmol/L) and ketone (mmol/L) readings, with a live color-coded zone preview (green/yellow/red) shown while entering values, using disclosed, non-clinical thresholds (documented in `src/lib/ketosis.ts`)
- Trend charts (glucose and ketones plotted separately, last 7 readings) via `react-native-chart-kit` — Recharts (originally specified) is a web-only library and doesn't run in React Native, so this substitution was made on Day 4
- Full reading history list, color-coded by zone
- PDF export via `expo-print` + `expo-sharing`, includes a disclaimer that it's descriptive tracking data, not a clinical diagnostic report
- Offline-aware: if no connectivity, a reading is queued locally and synced automatically on reconnect (see Section 4)

### 3.4 Treatment Log — ✅ Built
**User story:** As a physician, I want to record what radionuclide treatment was administered — including dose, isotope, and target — determined through my own clinical process, so I have a complete, auditable treatment history for each patient.

**As built:**
- Physician logs: isotope (Lu-177, Y-90, I-131, Ra-223, other), target receptor/tissue, dose administered + unit (mCi/GBq), dosimetry source reference, administration date, notes
- **The app performs no dose calculation.** Dose fields are physician/physicist-entered values only.
- **Enforced rule, confirmed working:** a dose value cannot be saved without a dosimetry source reference — validated in the app and testable end-to-end (attempting to save a dose without a source is blocked with an explicit error)
- Organ dose readings and safety threshold flagging live under a per-treatment detail screen (see Section 3.6)
- Offline-aware, same as Metabolic Monitoring

### 3.5 Monitoring Dashboard — ✅ Built
**User story:** As a physician, I want to see all my active treatment cases, upcoming imaging dates, and treatment response at a glance, so I can manage my caseload efficiently.

**As built:**
- Institution-wide (cross-patient) dashboard listing every treatment log, with patient name, isotope, days-since-administered, and next-imaging-due-date
- Tapping a treatment opens a detail screen where the physician selects any two of that patient's existing scans as "pre" and "post," shown side-by-side when both are PNG/JPEG
- Next imaging due date and physician's own response notes are saved per treatment (`treatment_monitoring` table)
- Treatment summary PDF export, same pattern as Metabolic Monitoring's export

### 3.6 Safety & Compliance — ✅ Built
**User story:** As a physician/admin, I want assurance that patient data is secure, access is logged, and only credentialed staff can act on records, so the platform meets clinical data-handling standards.

**As built:**
- Lock screen using device biometric (Face/Fingerprint) or PIN/pattern fallback, shown on login and every time the app returns from background — not a one-time login gate, a persistent screen lock, confirmed working on a PIN-secured test device
- Row-level security enforces institution-scoped access on all clinical tables — confirmed via live cross-institution test (a second institution's account saw zero records from the first)
- Every create/update action and every patient/treatment-detail view is recorded in the append-only `audit_logs` table, readable only by admin role
- Unverified credentials block write access — confirmed via live test (an unverified account could view existing patients but was blocked at the database level, not just the UI, when attempting to create one)
- Organ dose readings are compared against an optional reference threshold; exceeding it raises a visible safety flag on the treatment detail screen — a threshold comparison, not an app-generated clinical judgment
- Sign-out available from the Patient List screen

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Offline support** | Scoped to the two highest-value write flows: metabolic log and treatment log entries queue locally (persisted across app restarts) when offline and sync automatically on reconnect, with a visible pending-sync count and manual retry. Patient list falls back to last-cached data when offline. Broader offline support (e.g., imaging upload queuing, treatment monitoring edits) was deliberately not built for MVP — see Section 5. |
| **Data security** | TLS in transit, AES-256 at rest (Supabase default), RLS on all clinical tables |
| **Auth** | Email/password + persistent biometric/PIN lock screen (re-engages on every app foreground, not just at login); 2FA for institution admin accounts remains a future enhancement, not yet built |
| **Compliance posture** | Aligned with HIPAA/GDPR data-handling principles; positioned for engagement with PPB (Kenya) / NAFDAC (Nigeria) as a clinical support/record-keeping tool — classification to be confirmed directly with regulators before wide deployment |
| **Platform** | Android APK (EAS Build, `preview` profile); iOS/web/desktop deferred to post-MVP |
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

## 8. Open Questions — Resolved / Remaining

**Resolved during build:**
- *Conflict resolution for offline sync writes:* Not applicable in practice — the offline queue only handles new record creation (metabolic logs, treatment logs), not edits to existing records. Each queued item is an independent insert, so there's no competing-version conflict to resolve. **Known limitation:** edits made through Treatment Monitoring (next imaging date, response notes) are not offline-queued — they require connectivity. This was a deliberate MVP scope decision (Day 9), not an oversight, but worth expanding in a future iteration if offline edit support becomes a real field need.

**Still open:**
- Long-term imaging rendering path (Orthanc integration timeline) — remains deferred to Phase 2
- Formal regulatory engagement timeline with PPB/NAFDAC ahead of hospital pilot — see Section 6; recommended next concrete step post-MVP
- iOS build — not attempted in this build cycle (would require a paid Apple Developer account and separate EAS build profile)

---

## 9. Monetization Strategy (Phased)

Pricing and revenue models are scoped to what the product actually does at each stage — features are not charged for ahead of being built, and nothing here is charged for ahead of applicable certification/regulatory clearance where relevant (see Section 6).

### 9.1 Phase 1 — Launch (current MVP)

**Model: flat per-institution subscription. No freemium tier.**

- The MVP's core value is institutional, not individual — shared multi-doctor records, institution-scoped RLS, and audit compliance are only fully realized at the hospital level. A crippled free tier doesn't meaningfully demonstrate this, so Phase 1 skips freemium rather than building and maintaining one prematurely.
- **Single tier, covering everything currently built:** patient management, imaging upload/viewer, metabolic monitoring, treatment logging, monitoring dashboard, and the full safety/compliance layer (audit logging, RLS, credential verification, biometric lock).
- **Pricing:** anchored to target market income level (Kenya/Nigeria first) — indicative starting range in the $20-150/month per institution band, not per doctor, since the product's access model is already institution-wide.
- **First pilot hospital(s):** recommend offering free or heavily discounted access in exchange for structured feedback and a case study. With zero deployed references, a strong first case study is worth more than early revenue.

### 9.2 Phase 2 — Certification-gated upsells (post-MVP, future)

These features are explicitly out of scope for the current build (Section 5) and remain future roadmap items, gated by the same principle as the rest of this product: no feature ships or is charged for until it's been validated and, where applicable, cleared with the relevant regulator.

- **AI-based imaging analysis (radiomics, segmentation, SUV extraction)** — would likely require SaMD-equivalent regulatory clearance before it's responsible to ship at all, let alone monetize. Premium upsell only after that clearance.
- **Automated dosimetry** — same principle, arguably higher stakes given it concerns radiation dosing directly.
- **PACS/EMR/lab system integration** — reasonable as a one-time integration fee once Orthanc-based imaging (Section 5) is actually built.
- **API access tiers** — viable once there's real third-party integration demand from hospital IT departments; premature to price now.

### 9.3 Phase 3 — Partnerships (future)

**Supplier partnerships (commission/revenue-share):**
- **Isotope suppliers** (e.g., Lu-177, Y-90 distributors) — commission-based revenue share on sales referred through institutional relationships. **Guardrail:** any such partnership must not influence which isotopes are presented, defaulted to, or made easier to select in the Treatment Log — the app's "no treatment recommendation" positioning (Section 1.2) has to hold regardless of which suppliers are commercial partners.
- **Metabolic monitoring kit suppliers** (glucose/ketone meter manufacturers) — referral or revenue-share partnerships, lower stakes than isotope partnerships since these don't touch treatment decisions.