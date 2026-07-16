-- Migration 0003: Storage RLS policies for patient-imaging bucket
-- Run AFTER creating the 'patient-imaging' bucket in Supabase Storage UI.
-- Scopes access so a user can only read/write files under a path prefix
-- matching their own institution_id, keeping storage access consistent
-- with the table-level RLS already applied to imaging_records.

-- Upload convention: files are stored at paths like:
--   {institution_id}/{patient_id}/{filename}
-- This lets us scope storage RLS by institution without a extra lookup table.

create policy "imaging_storage_select"
on storage.objects for select
using (
  bucket_id = 'patient-imaging'
  and (storage.foldername(name))[1] = current_institution_id()::text
);

create policy "imaging_storage_insert"
on storage.objects for insert
with check (
  bucket_id = 'patient-imaging'
  and (storage.foldername(name))[1] = current_institution_id()::text
  and is_credential_verified()
);

create policy "imaging_storage_delete"
on storage.objects for delete
using (
  bucket_id = 'patient-imaging'
  and (storage.foldername(name))[1] = current_institution_id()::text
  and is_credential_verified()
);