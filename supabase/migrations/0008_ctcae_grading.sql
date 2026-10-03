create type toxicity_assessment_type as enum ('baseline', 'follow_up');

create table toxicity_assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  institution_id uuid not null references institutions(id),
  assessment_type toxicity_assessment_type not null,
  cycle_number integer,
  ctcae_version text not null default '5.0',
  events jsonb not null default '[]'::jsonb
    check (jsonb_typeof(events) = 'array'),
  assessed_by uuid references profiles(id),
  assessed_at timestamptz not null default now(),
  constraint toxicity_cycle_by_type_check check (
    (assessment_type = 'baseline' and cycle_number is null)
    or (assessment_type = 'follow_up' and cycle_number is not null and cycle_number > 0)
  )
);

create index idx_toxicity_assessments_patient_date
  on toxicity_assessments(patient_id, assessed_at desc);
create index idx_toxicity_assessments_institution
  on toxicity_assessments(institution_id);

alter table toxicity_assessments enable row level security;

create policy "toxicity_assessments_select_same_institution" on toxicity_assessments
  for select using (institution_id = current_institution_id());

create policy "toxicity_assessments_insert_same_institution_verified" on toxicity_assessments
  for insert with check (
    institution_id = current_institution_id()
    and is_credential_verified()
    and exists (
      select 1 from patients p
      where p.id = patient_id
        and p.institution_id = current_institution_id()
    )
  );

create table toxicity_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  institution_id uuid not null references institutions(id),
  assessment_id uuid not null references toxicity_assessments(id) on delete cascade,
  event_summary text not null,
  acknowledged boolean not null default false,
  acknowledged_by uuid references profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_toxicity_alerts_patient_pending
  on toxicity_alerts(patient_id, created_at desc)
  where acknowledged = false;

alter table toxicity_alerts enable row level security;

create policy "toxicity_alerts_select_same_institution" on toxicity_alerts
  for select using (institution_id = current_institution_id());

create policy "toxicity_alerts_insert_same_institution_verified" on toxicity_alerts
  for insert with check (
    institution_id = current_institution_id()
    and is_credential_verified()
    and exists (
      select 1 from patients p
      where p.id = patient_id
        and p.institution_id = current_institution_id()
    )
  );

create policy "toxicity_alerts_acknowledge_physician_admin" on toxicity_alerts
  for update
  using (
    institution_id = current_institution_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.institution_id = current_institution_id()
        and p.credential_verified
        and p.role in ('admin', 'physician')
    )
  )
  with check (
    institution_id = current_institution_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.institution_id = current_institution_id()
        and p.credential_verified
        and p.role in ('admin', 'physician')
    )
  );