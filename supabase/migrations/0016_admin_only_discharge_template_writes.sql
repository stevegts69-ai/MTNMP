drop policy "discharge_checklist_templates_insert_verified"
  on discharge_checklist_templates;
drop policy "discharge_checklist_templates_update_verified"
  on discharge_checklist_templates;
drop policy "discharge_instruction_templates_insert_verified"
  on discharge_instruction_templates;
drop policy "discharge_instruction_templates_update_verified"
  on discharge_instruction_templates;

create policy "discharge_checklist_templates_insert_verified" on discharge_checklist_templates
  for insert with check (
    institution_id = current_institution_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.institution_id = current_institution_id()
        and p.role = 'admin'
        and p.credential_verified
    )
  );

create policy "discharge_checklist_templates_update_verified" on discharge_checklist_templates
  for update
  using (
    institution_id = current_institution_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.institution_id = current_institution_id()
        and p.role = 'admin'
        and p.credential_verified
    )
  )
  with check (
    institution_id = current_institution_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.institution_id = current_institution_id()
        and p.role = 'admin'
        and p.credential_verified
    )
  );

create policy "discharge_instruction_templates_insert_verified" on discharge_instruction_templates
  for insert with check (
    institution_id = current_institution_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.institution_id = current_institution_id()
        and p.role = 'admin'
        and p.credential_verified
    )
  );

create policy "discharge_instruction_templates_update_verified" on discharge_instruction_templates
  for update
  using (
    institution_id = current_institution_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.institution_id = current_institution_id()
        and p.role = 'admin'
        and p.credential_verified
    )
  )
  with check (
    institution_id = current_institution_id()
    and exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.institution_id = current_institution_id()
        and p.role = 'admin'
        and p.credential_verified
    )
  );