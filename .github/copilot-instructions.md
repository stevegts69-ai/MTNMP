# Repository instructions

## Scope and architecture

- The mobile app is in `app/`. Run app commands from that directory.
- Stack: Expo 54, React Native 0.81, React 19, TypeScript 5.9 strict mode, React Navigation 7, NativeWind/Tailwind, Zustand, Supabase, and Sentry.
- Application code lives in `app/src/`: screens, shared components, navigation, Zustand stores, utilities, and shared types.
- Requirements and the domain model are documented in `PRD.md` and `SCHEMA_DESIGN.md`.

## Implementation conventions

- Follow existing patterns in nearby screens and keep changes surgical.
- Use strict, explicit TypeScript types. Keep `app/src/types/index.ts` synchronized with database fields.
- Use functional components, hooks, React Navigation param types, and existing Zustand/Supabase helpers.
- Style with NativeWind classes and existing `clinical-*` theme values.
- Preserve loading, error, empty, offline, and confirmation states on affected flows.
- Do not add dependencies or upgrade Expo/React Native packages unless the task explicitly requires it.

## Clinical, privacy, and regulatory constraints

- This app records physician/physicist decisions; it does not diagnose, calculate a dose, recommend treatment, detect lesions, or extract SUV values.
- Preserve institution-scoped RLS and include `institution_id` on clinical records. Never replace RLS with a client-only security assumption.
- Gate write actions by `profile.credential_verified`, while relying on database policies as the final enforcement.
- Log relevant actions through `app/src/lib/audit.ts`, including creates, updates, views, exports, and deletes.
- A dose may not be stored when a dosimetry source is absent. Preserve validation and the source-reference provenance field.
- All descriptive metabolic, toxicity, organ-dose, and imaging content must avoid implying an app-generated diagnosis or clinical decision.
- Keep DICOM as a stored/downloaded placeholder and show only PNG/JPEG previews. Do not build in-app DICOM rendering or imaging AI.
- Never include patient-identifiable information in logs or Sentry telemetry. Client-side PII scrubbing in `App.tsx` must not be weakened.

## UI wording

- Do not use `biopsy`, `chemotherapy`, `chemo`, `surgery`, or `radiation` in UI labels, placeholders, alerts, help text, or exported PDFs.
- Use neutral wording that preserves physician judgment and does not imply the app supplies the broader care plan.

## Offline and data behavior

- The MVP queues only new metabolic and treatment records in `app/src/store/offlineQueueStore.ts`.
- Use NetInfo for connectivity decisions and retain pending-count/manual-sync behavior.
- Keep patient-list offline caching best-effort and do not silently discard existing records or queue state.

## Validation

- From `app/`, run `npx tsc --noEmit`.
- Use `npx expo start --clear` for interactive validation.
- There is no test or lint script today. Run the smallest relevant validation available and use a real Expo/Android build only if the task affects native configuration or dependencies.
- For the preview Android build, use `npx eas-cli build --platform android --profile preview`.
