create policy "chat_channels_select_creator" on public.chat_channels
  for select using (
    chat_channels.institution_id = public.current_institution_id()
    and chat_channels.created_by = auth.uid()
    and public.is_credential_verified()
  );

create or replace function public.chat_is_channel_member(target_channel_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.is_credential_verified()
    and exists (
      select 1
      from public.chat_members as chat_members
      where chat_members.channel_id = target_channel_id
        and chat_members.user_id = auth.uid()
        and chat_members.institution_id = public.current_institution_id()
    );
$$;

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
          (target_user_id = auth.uid() and chat_channels.kind = 'team')
          or chat_channels.created_by = auth.uid()
        )
    );
$$;

revoke update on public.chat_members from authenticated, anon;
grant update (last_read_at) on public.chat_members to authenticated;
revoke all on public.chat_channels, public.chat_members, public.chat_messages from anon;

alter function public.is_credential_verified() set search_path = public, pg_temp;
alter function public.current_institution_id() set search_path = public, pg_temp;