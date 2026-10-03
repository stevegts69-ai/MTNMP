create type dosimetry_calculation_method as enum (
  'MIRD',
  'voxel-based',
  'Monte Carlo',
  'other'
);

create table dosimetry_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  institution_id uuid not null references institutions(id),
  cycle_number integer not null check (cycle_number > 0),
  isotope isotope_type not null,
  calculation_method dosimetry_calculation_method not null,
  imaging_timepoints jsonb not null default '[]'::jsonb
    check (jsonb_typeof(imaging_timepoints) = 'array'),
  organ_doses jsonb not null default '[]'::jsonb
    check (jsonb_typeof(organ_doses) = 'array'),
  tumor_doses jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tumor_doses) = 'array'),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_dosimetry_patient_created
  on dosimetry_records(patient_id, created_at desc);
create index idx_dosimetry_institution
  on dosimetry_records(institution_id);

alter table dosimetry_records enable row level security;

create policy "dosimetry_select_same_institution" on dosimetry_records
  for select using (institution_id = current_institution_id());

create policy "dosimetry_insert_same_institution_verified" on dosimetry_records
  for insert with check (
    institution_id = current_institution_id()
    and is_credential_verified()
  );

create policy "dosimetry_update_same_institution_verified" on dosimetry_records
  for update
  using (
    institution_id = current_institution_id()
    and is_credential_verified()
  )
  with check (
    institution_id = current_institution_id()
    and is_credential_verified()
  );