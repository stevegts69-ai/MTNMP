# Project Status — Handoff Summary
## Metabolic Nuclear Medicine Platform

**Use this doc to start a new Claude conversation with full context.** Paste this whole file as your first message, then continue from "Where we are right now" below.

---

## What this project is

A React Native (Expo) mobile app for physicians — clinical record-keeping and monitoring for metabolic tracking alongside established targeted radionuclide therapy (Lu-177, Y-90, I-131, Ra-223). NOT a diagnostic tool, NOT a dose calculator. Full product thesis, scope, and scientific grounding are in `PRD.md` — refer Claude to that file for the "why" behind every scope boundary.

**Critical standing rules Claude must keep following:**
- Never use the words "biopsy," "chemo/chemotherapy," "surgery," or "radiation" anywhere in app UI, PRD, or code comments — see PRD Section 7 for the full convention and reasoning.
- Never claim the app is "HIPAA compliant" — only "aligned with HIPAA/GDPR data-handling principles" (no formal compliance audit has been done).
- The app never calculates doses or recommends treatment — every treatment/dose field is physician-entered, with mandatory dosimetry source attribution.
- Individual-level patient data monetization to insurers is explicitly excluded from the roadmap (see PRD Section 9.3) — do not reintroduce this direction.

## Tech stack
Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript, NativeWind (Tailwind), Zustand, Supabase (Postgres + Auth + Storage + RLS), react-native-chart-kit, expo-print/sharing, expo-local-authentication, EAS Build.

## Repo structure
- `/app` — the Expo project
- `/supabase/migrations` — 3 SQL migrations (schema, check constraints, storage policies), all applied
- `PRD.md`, `SCHEMA_DESIGN.md`, `BUILD_PLAN.md` — living docs at repo root, keep updated as things change

## Where we are right now

**MVP (10-day build) — 100% complete and working**, tested end-to-end on a real Android device via EAS-built APK (not just Expo Go). All modules built: Patients, Imaging (upload + PNG/JPEG preview, DICOM-as-placeholder), Metabolic Monitoring (ketosis zone calc, trend charts, PDF export), Treatment Log (mandatory dosimetry source validation), Monitoring Dashboard (cross-patient, pre/post imaging comparison), Safety & Compliance (biometric/PIN lock screen, RLS confirmed via live cross-institution test, audit logging, credential verification confirmed blocking writes at the DB level), offline write queue (metabolic/treatment logs), and — just added — a 4-slide onboarding flow shown once on first launch.

Tagged in git as `v1.0-mvp`.

**Now moving to: Production-grade launch for two real destinations:**
1. **AI Foundry's own hardware device** ("device-pep") — standard Android with Google Play Services, nothing exotic
2. **Loveworld App Store** — accepts APK submissions directly, informal/relationship-based review (no formal published requirements)

**Deadline: 1 week from when this plan was made.**

### The 7-day production plan (agreed, in progress)

| Day | Task | Status |
|---|---|---|
| 1 | Separate production Supabase project (must never share DB with dev/test accounts) | **Not started — next task** |
| 2 | Admin approval screen (real UI for `credential_verified`, replacing manual SQL) | Not started |
| 3 | Error monitoring (Sentry or similar) | Not started |
| 4 | Legal essentials (Privacy Policy, Terms of Service) + first-launch disclaimer | Onboarding screen done (just built); legal docs still needed |
| 5 | Production polish pass (versioning, remove dev artifacts, permissions review) | Not started |
| 6 | Full QA pass on production APK | Not started |
| 7 | Final build + submission package + buffer | Not started |

**Deliberately deferred past this deadline** (documented, not forgotten): automated test suite/CI pipeline, EAS Update (OTA), iOS build.

### Just completed (most recent work)
- Fixed a real bug: all `TextInput` fields had invisible text/placeholders in the standalone build (not caught via Expo Go testing) — fixed via a shared `AppTextInput` wrapper component now used everywhere.
- Removed 3 dead placeholder tabs (Imaging/Metabolic/Treatment were never meant to be top-level tabs — those features live inside Patient Detail navigation, a Day 3 decision). Bottom tabs are now just Patients + Monitoring.
- Added offline cache fallback to Patient Detail screen (previously only the Patient List had this).
- Built and wired in the onboarding screen (4 slides: app purpose, scientific grounding, "clinical support tool, not a diagnostic device," data protection/HIPAA-GDPR alignment).

### Immediate next step when resuming
Start **Day 1 of the production plan**: walk through creating a fresh, separate Supabase project for production, running all 3 migrations against it, and updating the app's `.env` to point to it — keeping the dev/test project (with `doctor2@test.com`, `doctor3@test.com`, Second Test Hospital, etc.) completely separate from anything real patient data will touch.

---

## Working style notes for Claude (established over 10 days of building together)

- Steve is non-technical but capable and engaged — explain *why*, not just *what*, especially for infrastructure/tooling decisions.
- File handoff method that works well: Claude creates/edits files in its own sandbox, typechecks with `npx tsc --noEmit`, then pastes full file contents in chat for Steve to copy into Codespaces (select-all, delete, paste, save) — this has been far more reliable than tar/zip uploads, which repeatedly hit dotfile/Word/Notepad corruption issues early on.
- Steve manages GitHub Codespaces hours carefully (30/month free tier) — remind him to stop Codespaces during any long-running cloud process (EAS builds, waiting periods), and always confirm `pwd` before git commands since directory confusion has caused several near-miss uncommitted-changes incidents.
- `EXPO_TOKEN` must be re-exported each fresh Codespaces session (`export EXPO_TOKEN=...` then `eas whoami` to confirm) — this is expected, not a bug.
- Steve is thoughtful about the product's ethical/scientific boundaries and pushes back constructively — treat his judgment calls (like the biopsy wording rule, the insurance data exclusion) as considered decisions to uphold consistently, not one-off preferences to relitigate.
