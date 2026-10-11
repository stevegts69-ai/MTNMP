drop policy "exposure_logs_insert_verified" on exposure_logs;

create policy "exposure_logs_insert_verified" on exposure_logs
  for insert with check (
    institution_id = current_institution_id()
    and is_credential_verified()
    and exists (
      select 1
      from treatment_logs t
      where t.id = exposure_logs.treatment_log_id
        and t.patient_id = exposure_logs.patient_id
        and t.institution_id = current_institution_id()
    )
  );