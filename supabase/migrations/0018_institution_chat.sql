create type public.chat_channel_kind as enum ('team', 'patient', 'direct');

create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id),
  kind public.chat_channel_kind not null,
  name text,
  patient_id uuid references public.patients(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((kind = 'patient') = (patient_id is not null))
);

create table public.chat_members (
  channel_id uuid not null references public.chat_channels(id),
  user_id uuid not null references public.profiles(id),
  institution_id uuid not null references public.institutions(id),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id),
  institution_id uuid not null references public.institutions(id),
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index idx_chat_messages_channel_created_at
  on public.chat_messages(channel_id, created_at);
create index idx_chat_members_user_id
  on public.chat_members(user_id);

alter table public.chat_channels enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_messages enable row level security;

create or replace function public.chat_is_channel_member(target_channel_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
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
  select target_institution_id = public.current_institution_id()
    and exists (
      select 1
      from public.profiles as profiles
      where profiles.id = target_user_id
        and profiles.institution_id = target_institution_id
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

revoke all on function public.chat_is_channel_member(uuid) from public;
grant execute on function public.chat_is_channel_member(uuid) to authenticated;
revoke all on function public.chat_can_add_member(uuid, uuid, uuid) from public;
grant execute on function public.chat_can_add_member(uuid, uuid, uuid) to authenticated;

create policy "chat_channels_select_member" on public.chat_channels
  for select using (
    chat_channels.institution_id = public.current_institution_id()
    and public.chat_is_channel_member(chat_channels.id)
  );

create policy "chat_channels_insert_verified" on public.chat_channels
  for insert with check (
    chat_channels.institution_id = public.current_institution_id()
    and chat_channels.created_by = auth.uid()
    and public.is_credential_verified()
    and (
      chat_channels.kind <> 'patient'
      or exists (
        select 1
        from public.patients as patients
        where patients.id = chat_channels.patient_id
          and patients.institution_id = chat_channels.institution_id
      )
    )
  );

create policy "chat_members_select_member" on public.chat_members
  for select using (
    chat_members.institution_id = public.current_institution_id()
    and public.chat_is_channel_member(chat_members.channel_id)
  );

create policy "chat_members_insert_self_or_creator" on public.chat_members
  for insert with check (
    chat_members.institution_id = public.current_institution_id()
    and public.chat_can_add_member(
      chat_members.channel_id,
      chat_members.user_id,
      chat_members.institution_id
    )
  );

create policy "chat_members_update_own_last_read" on public.chat_members
  for update
  using (
    chat_members.user_id = auth.uid()
    and chat_members.institution_id = public.current_institution_id()
  )
  with check (
    chat_members.user_id = auth.uid()
    and chat_members.institution_id = public.current_institution_id()
  );

create policy "chat_messages_select_member" on public.chat_messages
  for select using (
    chat_messages.institution_id = public.current_institution_id()
    and public.chat_is_channel_member(chat_messages.channel_id)
  );

create policy "chat_messages_insert_member_verified" on public.chat_messages
  for insert with check (
    chat_messages.sender_id = auth.uid()
    and chat_messages.institution_id = public.current_institution_id()
    and public.is_credential_verified()
    and public.chat_is_channel_member(chat_messages.channel_id)
  );

revoke all on public.chat_channels, public.chat_members, public.chat_messages
  from anon, authenticated;
grant select, insert on public.chat_channels to authenticated;
grant select, insert on public.chat_members to authenticated;
grant update (last_read_at) on public.chat_members to authenticated;
grant select, insert on public.chat_messages to authenticated;

alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_members;