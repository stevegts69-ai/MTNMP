-- Migration 0002: Data integrity CHECK constraints
-- Adds sanity-bound range checks on numeric clinical fields.
-- These are data-integrity guardrails (catching typos/entry errors), NOT clinical
-- thresholds — bounds should be reviewed by a physician before relying on them
-- for anything beyond basic sanity-checking.

-- metabolic_logs: glucose and ketone readings
alter table metabolic_logs
  add constraint glucose_range_check
    check (glucose_mmol_l is null or (glucose_mmol_l > 0 and glucose_mmol_l < 55)),
  add constraint ketones_range_check
    check (ketones_mmol_l is null or (ketones_mmol_l >= 0 and ketones_mmol_l < 10));

-- treatment_logs: dose administered must be a positive value if present
alter table treatment_logs
  add constraint dose_administered_positive_check
    check (dose_administered is null or dose_administered > 0);

-- organ_dose_logs: dose values must be non-negative
alter table organ_dose_logs
  add constraint organ_dose_value_check
    check (dose_value is null or dose_value >= 0),
  add constraint organ_dose_limit_check
    check (dose_limit_reference is null or dose_limit_reference >= 0);

-- safety_alerts: threshold/entered values must be non-negative
alter table safety_alerts
  add constraint alert_threshold_check
    check (threshold_value is null or threshold_value >= 0),
  add constraint alert_entered_value_check
    check (entered_value is null or entered_value >= 0);

-- patients: date_of_birth cannot be in the future
alter table patients
  add constraint dob_not_future_check
    check (date_of_birth is null or date_of_birth <= current_date);