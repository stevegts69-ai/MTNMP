-- Metabolic-Targeted Nuclear Medicine Platform
-- Initial schema migration

-- ============ ENUMS ============
create type user_role as enum ('physician', 'radiologist', 'nuclear_med_physicist', 'admin');
create type scan_type as enum ('PET_CT', 'SPECT', 'MRI', 'other');
create type file_type as enum ('DICOM', 'PNG', 'JPEG');
create type ketosis_zone as enum ('green', 'yellow', 'red');
create type isotope_type as enum ('Lu177', 'Y90', 'I131', 'Ra223', 'other');
create type dose_unit as enum ('mCi', 'GBq');
create type audit_action as enum ('view', 'create', 'update', 'delete', 'export');

-- ============ TABLES ============

create table institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  regulatory_body text,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  institution_id uuid references institutions(id),
  full_name text not null,
  role user_role not null,
  credential_number text,
  credential_verified boolean not null default false,
  created_at timestamptz not null default now()
);

create table patients (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  mrn text not null,
  full_name text not null,
  date_of_birth date,
  sex text,
  cancer_type text,
  cancer_stage text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (institution_id, mrn)
);

create table imaging_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  institution_id uuid not null references institutions(id),
  scan_type scan_type not null,
  storage_path text not null,
  file_type file_type not null,
  scan_date date,
  comparison_group_id uuid,
  notes text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table metabolic_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  institution_id uuid not null references institutions(id),
  glucose_mmol_l numeric,
  ketones_mmol_l numeric,
  ketosis_zone ketosis_zone,
  logged_at timestamptz not null default now(),
  logged_by uuid references profiles(id)
);

create table treatment_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  institution_id uuid not null references institutions(id),
  isotope isotope_type not null,
  target_receptor_or_tissue text,
  dose_administered numeric,
  dose_unit dose_unit,
  dosimetry_source text,
  administered_date date,
  administered_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table organ_dose_logs (
  id uuid primary key default gen_random_uuid(),
  treatment_log_id uuid not null references treatment_logs(id) on delete cascade,
  organ text not null,
  dose_value numeric,
  dose_limit_reference numeric,
  recorded_at timestamptz not null default now()
);

create table treatment_monitoring (
  id uuid primary key default gen_random_uuid(),
  treatment_log_id uuid not null references treatment_logs(id) on delete cascade,
  pre_imaging_id uuid references imaging_records(id),
  post_imaging_id uuid references imaging_records(id),
  next_imaging_due_date date,
  response_notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table safety_alerts (
  id uuid primary key default gen_random_uuid(),
  treatment_log_id uuid not null references treatment_logs(id) on delete cascade,
  alert_type text not null,
  threshold_value numeric,
  entered_value numeric,
  triggered_at timestamptz not null default now(),
  acknowledged_by uuid references profiles(id),
  acknowledged_at timestamptz
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  institution_id uuid references institutions(id),
  action audit_action not null,
  table_name text not null,
  record_id uuid,
  ip_address text,
  "timestamp" timestamptz not null default now()
);

-- ============ INDEXES ============
create index idx_patients_institution on patients(institution_id);
create index idx_imaging_patient on imaging_records(patient_id);
create index idx_imaging_institution on imaging_records(institution_id);
create index idx_metabolic_patient on metabolic_logs(patient_id);
create index idx_treatment_patient on treatment_logs(patient_id);
create index idx_organ_dose_treatment on organ_dose_logs(treatment_log_id);
create index idx_monitoring_treatment on treatment_monitoring(treatment_log_id);
create index idx_audit_user on audit_logs(user_id);
create index idx_audit_institution on audit_logs(institution_id);

-- ============ RLS ============
alter table institutions enable row level security;
alter table profiles enable row level security;
alter table patients enable row level security;
alter table imaging_records enable row level security;
alter table metabolic_logs enable row level security;
alter table treatment_logs enable row level security;
alter table organ_dose_logs enable row level security;
alter table treatment_monitoring enable row level security;
alter table safety_alerts enable row level security;
alter table audit_logs enable row level security;

-- Helper: get current user's institution_id
create or replace function current_institution_id()
returns uuid
language sql
security definer
stable
as $$
  select institution_id from profiles where id = auth.uid();
$$;

-- Helper: check if current user's credential is verified
create or replace function is_credential_verified()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(credential_verified, false) from profiles where id = auth.uid();
$$;

-- profiles: users can see profiles within their own institution
create policy "profiles_select_same_institution" on profiles
  for select using (institution_id = current_institution_id());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- patients: institution-wide shared access, verified credential required to write
create policy "patients_select" on patients
  for select using (institution_id = current_institution_id());
create policy "patients_insert" on patients
  for insert with check (institution_id = current_institution_id() and is_credential_verified());
create policy "patients_update" on patients
  for update using (institution_id = current_institution_id() and is_credential_verified());

-- imaging_records
create policy "imaging_select" on imaging_records
  for select using (institution_id = current_institution_id());
create policy "imaging_insert" on imaging_records
  for insert with check (institution_id = current_institution_id() and is_credential_verified());

-- metabolic_logs
create policy "metabolic_select" on metabolic_logs
  for select using (institution_id = current_institution_id());
create policy "metabolic_insert" on metabolic_logs
  for insert with check (institution_id = current_institution_id() and is_credential_verified());

-- treatment_logs
create policy "treatment_select" on treatment_logs
  for select using (institution_id = current_institution_id());
create policy "treatment_insert" on treatment_logs
  for insert with check (institution_id = current_institution_id() and is_credential_verified());

-- organ_dose_logs (via treatment_log's institution)
create policy "organ_dose_select" on organ_dose_logs
  for select using (
    exists (select 1 from treatment_logs t where t.id = treatment_log_id and t.institution_id = current_institution_id())
  );
create policy "organ_dose_insert" on organ_dose_logs
  for insert with check (
    exists (select 1 from treatment_logs t where t.id = treatment_log_id and t.institution_id = current_institution_id())
    and is_credential_verified()
  );

-- treatment_monitoring
create policy "monitoring_select" on treatment_monitoring
  for select using (
    exists (select 1 from treatment_logs t where t.id = treatment_log_id and t.institution_id = current_institution_id())
  );
create policy "monitoring_insert" on treatment_monitoring
  for insert with check (
    exists (select 1 from treatment_logs t where t.id = treatment_log_id and t.institution_id = current_institution_id())
    and is_credential_verified()
  );

-- safety_alerts
create policy "alerts_select" on safety_alerts
  for select using (
    exists (select 1 from treatment_logs t where t.id = treatment_log_id and t.institution_id = current_institution_id())
  );
create policy "alerts_insert" on safety_alerts
  for insert with check (
    exists (select 1 from treatment_logs t where t.id = treatment_log_id and t.institution_id = current_institution_id())
  );

-- audit_logs: append-only, admin-only read
create policy "audit_insert_any_authenticated" on audit_logs
  for insert with check (auth.uid() is not null);
create policy "audit_select_admin_only" on audit_logs
  for select using (
    institution_id = current_institution_id()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- institutions: readable by members, no client-side insert (provisioned by admin/backend)
create policy "institutions_select_own" on institutions
  for select using (id = current_institution_id());
