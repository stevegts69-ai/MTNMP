alter table treatment_logs
  add column cycle_number integer,
  add column total_planned_cycles integer,
  add column cycle_interval_days integer;

alter table treatment_logs
  add constraint treatment_cycle_metadata_positive_check check (
    (cycle_number is null or cycle_number > 0)
    and (total_planned_cycles is null or total_planned_cycles > 0)
    and (cycle_interval_days is null or cycle_interval_days > 0)
    and (
      cycle_number is null
      or total_planned_cycles is null
      or cycle_number <= total_planned_cycles
    )
  );