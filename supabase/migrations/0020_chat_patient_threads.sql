create or replace function public.chat_can_add_member(
  target_channel_id uuid,
  target_user_id uuid,
  target_institution_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.is_credential_verified()
    and target_institution_id = public.current_institution_id()
    and exists (
      select 1
      from public.profiles as profiles
      where profiles.id = target_user_id
        and profiles.institution_id = target_institution_id
        and profiles.credential_verified = true
        and profiles.is_active = true
    )
    and exists (
      select 1
      from public.chat_channels as chat_channels
      where chat_channels.id = target_channel_id
        and chat_channels.institution_id = target_institution_id
        and (
          (target_user_id = auth.uid() and chat_channels.kind in ('team', 'patient'))
          or chat_channels.created_by = auth.uid()
        )
    );
$$;

create policy "chat_channels_select_open" on public.chat_channels
  for select using (
    chat_channels.institution_id = public.current_institution_id()
    and public.is_credential_verified()
    and chat_channels.kind in ('team', 'patient')
  );

create unique index idx_chat_channels_patient_unique
  on public.chat_channels(patient_id)
  where kind = 'patient';

create unique index idx_chat_channels_general_unique
  on public.chat_channels(institution_id)
  where kind = 'team' and name = 'General';