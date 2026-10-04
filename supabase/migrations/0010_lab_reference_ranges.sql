alter table metabolic_logs
  add column platelets numeric,
  add column hemoglobin numeric,
  add column creatinine numeric,
  add column egfr numeric,
  add column wbc numeric;

alter table metabolic_logs
  add constraint metabolic_lab_values_nonnegative check (
    (platelets is null or platelets >= 0)
    and (hemoglobin is null or hemoglobin >= 0)
    and (creatinine is null or creatinine >= 0)
    and (egfr is null or egfr >= 0)
    and (wbc is null or wbc >= 0)
  );

create table lab_reference_ranges (
  lab_type text primary key check (
    lab_type in ('platelets', 'hemoglobin', 'creatinine', 'egfr', 'wbc')
  ),
  normal_low numeric not null,
  normal_high numeric not null,
  grade1_threshold numeric not null,
  grade2_threshold numeric not null,
  grade3_threshold numeric not null,
  unit text not null,
  abnormal_direction text not null check (abnormal_direction in ('low', 'high')),
  check (normal_low <= normal_high)
);

alter table lab_reference_ranges enable row level security;

create policy "lab_reference_ranges_select_authenticated" on lab_reference_ranges
  for select using (auth.uid() is not null);

insert into lab_reference_ranges (
  lab_type,
  normal_low,
  normal_high,
  grade1_threshold,
  grade2_threshold,
  grade3_threshold,
  unit,
  abnormal_direction
) values
  ('platelets', 150, 450, 150, 75, 50, '10^9/L', 'low'),
  ('hemoglobin', 12, 17, 12, 10, 8, 'g/dL', 'low'),
  ('creatinine', 0.6, 1.2, 1.2, 3, 6, 'mg/dL', 'high'),
  ('egfr', 90, 120, 90, 60, 30, 'mL/min/1.73 m2', 'low'),
  ('wbc', 4, 11, 4, 3, 2, '10^9/L', 'low')
on conflict (lab_type) do update set
  normal_low = excluded.normal_low,
  normal_high = excluded.normal_high,
  grade1_threshold = excluded.grade1_threshold,
  grade2_threshold = excluded.grade2_threshold,
  grade3_threshold = excluded.grade3_threshold,
  unit = excluded.unit,
  abnormal_direction = excluded.abnormal_direction;