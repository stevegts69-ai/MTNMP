create type lesion_measurement_method as enum ('RECIST_1_1', 'PERCIST');

create table lesion_measurements (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  institution_id uuid not null references institutions(id),
  lesion_label text not null,
  is_target_lesion boolean not null default true,
  timepoint_date date not null,
  measurement_mm numeric,
  suv_max numeric,
  method lesion_measurement_method not null,
  is_new_lesion boolean not null default false,
  manual_percist_category text check (
    manual_percist_category in ('CMR', 'PMR', 'SMD', 'PMD')
  ),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint lesion_method_value_check check (
    (method = 'RECIST_1_1' and measurement_mm is not null and measurement_mm >= 0 and suv_max is null and manual_percist_category is null)
    or
    (method = 'PERCIST' and suv_max is not null and suv_max >= 0 and measurement_mm is null)
  )
);

create index idx_lesion_measurements_patient_date
  on lesion_measurements(patient_id, timepoint_date, lesion_label);
create index idx_lesion_measurements_institution
  on lesion_measurements(institution_id);

alter table lesion_measurements enable row level security;

create policy "lesion_measurements_select_same_institution" on lesion_measurements
  for select using (institution_id = current_institution_id());

create policy "lesion_measurements_insert_same_institution_verified" on lesion_measurements
  for insert with check (
    institution_id = current_institution_id()
    and is_credential_verified()
    and exists (
      select 1 from patients p
      where p.id = patient_id
        and p.institution_id = current_institution_id()
    )
  );