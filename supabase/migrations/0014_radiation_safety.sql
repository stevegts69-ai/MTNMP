alter table institutions
  add column emergency_contact_name text,
  add column emergency_phone text,
  add column after_hours_phone text;

create table discharge_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  isotope isotope_type not null,
  checklist_items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(checklist_items) = 'array'),
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (institution_id, isotope)
);

create table discharge_instruction_templates (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id) on delete cascade,
  isotope isotope_type not null,
  language text not null,
  body_text text not null default '',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  unique (institution_id, isotope, language)
);

create table discharge_checklists (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  treatment_log_id uuid not null references treatment_logs(id) on delete cascade,
  institution_id uuid not null references institutions(id),
  isotope isotope_type not null,
  checklist_items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(checklist_items) = 'array'),
  dose_rate_at_discharge numeric,
  dose_rate_unit text,
  completed_by text not null,
  completed_at timestamptz not null default now()
);

create table exposure_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  treatment_log_id uuid not null references treatment_logs(id) on delete cascade,
  institution_id uuid not null references institutions(id),
  log_date date not null default current_date,
  precaution_notes text,
  entered_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index idx_discharge_checklists_patient_date
  on discharge_checklists(patient_id, completed_at desc);
create index idx_exposure_logs_patient_date
  on exposure_logs(patient_id, log_date desc);

alter table discharge_checklist_templates enable row level security;
alter table discharge_instruction_templates enable row level security;
alter table discharge_checklists enable row level security;
alter table exposure_logs enable row level security;

create policy "discharge_checklist_templates_select_institution" on discharge_checklist_templates
  for select using (institution_id = current_institution_id());
create policy "discharge_checklist_templates_insert_verified" on discharge_checklist_templates
  for insert with check (institution_id = current_institution_id() and is_credential_verified());
create policy "discharge_checklist_templates_update_verified" on discharge_checklist_templates
  for update using (institution_id = current_institution_id() and is_credential_verified())
  with check (institution_id = current_institution_id() and is_credential_verified());

create policy "discharge_instruction_templates_select_institution" on discharge_instruction_templates
  for select using (institution_id = current_institution_id());
create policy "discharge_instruction_templates_insert_verified" on discharge_instruction_templates
  for insert with check (institution_id = current_institution_id() and is_credential_verified());
create policy "discharge_instruction_templates_update_verified" on discharge_instruction_templates
  for update using (institution_id = current_institution_id() and is_credential_verified())
  with check (institution_id = current_institution_id() and is_credential_verified());

create policy "discharge_checklists_select_institution" on discharge_checklists
  for select using (institution_id = current_institution_id());
create policy "discharge_checklists_insert_verified" on discharge_checklists
  for insert with check (
    institution_id = current_institution_id()
    and is_credential_verified()
    and exists (
      select 1 from patients p
      where p.id = patient_id and p.institution_id = current_institution_id()
    )
    and exists (
      select 1 from treatment_logs t
      where t.id = treatment_log_id
        and t.patient_id = patient_id
        and t.institution_id = current_institution_id()
    )
  );

create policy "exposure_logs_select_institution" on exposure_logs
  for select using (institution_id = current_institution_id());
create policy "exposure_logs_insert_verified" on exposure_logs
  for insert with check (
    institution_id = current_institution_id()
    and is_credential_verified()
    and exists (
      select 1 from treatment_logs t
      where t.id = treatment_log_id
        and t.patient_id = patient_id
        and t.institution_id = current_institution_id()
    )
  );