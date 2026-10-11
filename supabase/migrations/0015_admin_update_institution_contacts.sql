create policy "institutions_update_admin_verified" on institutions
  for update
  using (
    id = current_institution_id()
    and exists (
      select 1
      from profiles p
      where p.id = auth.uid()
        and p.institution_id = current_institution_id()
        and p.role = 'admin'
        and p.credential_verified
    )
  )
  with check (
    id = current_institution_id()
    and exists (
      select 1
      from profiles p
      where p.id = auth.uid()
        and p.institution_id = current_institution_id()
        and p.role = 'admin'
        and p.credential_verified
    )
  );