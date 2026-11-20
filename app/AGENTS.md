# MTNMP agent instructions

## Project context

- The application is in `app/`. It is an Expo 54 / React Native 0.81 / React 19 TypeScript mobile app.
- Backend access is through Supabase. Clinical records are institution-scoped and protected by row-level security and credential verification.
- This is a clinical record-keeping and monitoring tool, not a diagnostic or dosing system. Never add automated dose calculation, tumor detection, imaging diagnosis, or treatment recommendations.
- Keep changes aligned with `PRD.md` and `SCHEMA_DESIGN.md` at the repository root.

## Development rules

- Use strict TypeScript; keep types in `src/types/index.ts` synchronized with the Supabase schema.
- Use functional React components and React hooks. Use Zustand stores for shared state and Supabase directly in screens where that is the existing pattern.
- Use React Navigation 7 stack/tab types; declare route parameters in the owning navigator.
- Style UI with NativeWind/Tailwind classes and the existing `clinical-*` theme colors when possible.
- Keep patient-specific workflows under the patient stacks; use a top-level tab only for genuinely cross-patient or institution-wide views.
- Add loading, error, connectivity, and empty states for network-backed screens.
- Never log, export, or send patient-identifying data to Sentry or other telemetry.
- Never commit secrets or real patient data. Environment variables belong in `.env*` files and public client variables must use the `EXPO_PUBLIC_` prefix.

## Clinical and security constraints

- Preserve institution-wide access: include `institution_id` in institution-owned records and rely on Supabase RLS rather than client-only filtering.
- Read `profile.credential_verified` before exposing write actions; database RLS remains the authoritative enforcement point.
- Preserve audit logging for create, update, view, export, and delete actions. Use `src/lib/audit.ts`.
- A non-empty treatment dose requires a non-empty `dosimetry_source`. Do not remove or bypass this validation.
- Metabolic thresholds and toxicity ranges are descriptive/reference data. UI and PDFs must state that they are not diagnoses or treatment guidance.
- Do not present side-by-side imaging as definitive. Keep PNG/JPEG preview support and the DICOM placeholder/PACS workstation workflow.
- Do not add DICOM pixel rendering, automated radiopharmaceutical dosing, AI lesion analysis, or automated SUV extraction in the MVP.
- Do not use these words in UI text, placeholders, alerts, or exported PDFs: `biopsy`, `chemotherapy`, `chemo`, `surgery`, `radiation`.

## Offline behavior

- The only offline queue scope in the MVP is new `metabolic_logs` and `treatment_logs` records.
- Persist queued writes through `src/store/offlineQueueStore.ts`; do not add offline support for unrelated edits or imaging uploads without a separate design.
- Use `@react-native-community/netinfo` for connectivity checks and preserve the visible pending-sync state.

## Validation

- Work from `app/`.
- Install/use the checked-in dependencies with `npm install` or `npm ci`; do not install or upgrade Expo packages unless the task requires dependency changes.
- Run `npx tsc --noEmit` after TypeScript or screen changes.
- Run `npx expo start --clear` for interactive validation.
- Run `npx expo export --platform web` only when web behavior is intentionally in scope.
- For Android release validation, use `npx eas-cli build --platform android --profile preview`.
- There is currently no test script or configured lint script; add tests or scripts only when required by the change.
