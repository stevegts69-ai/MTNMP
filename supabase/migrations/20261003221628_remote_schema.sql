drop extension if exists "pg_net";

drop policy "toxicity_alerts_acknowledge_physician_admin" on "public"."toxicity_alerts";

drop policy "toxicity_alerts_insert_same_institution_verified" on "public"."toxicity_alerts";

drop policy "toxicity_alerts_select_same_institution" on "public"."toxicity_alerts";

drop policy "toxicity_assessments_insert_same_institution_verified" on "public"."toxicity_assessments";

drop policy "toxicity_assessments_select_same_institution" on "public"."toxicity_assessments";

revoke delete on table "public"."toxicity_alerts" from "anon";

revoke insert on table "public"."toxicity_alerts" from "anon";

revoke references on table "public"."toxicity_alerts" from "anon";

revoke select on table "public"."toxicity_alerts" from "anon";

revoke trigger on table "public"."toxicity_alerts" from "anon";

revoke truncate on table "public"."toxicity_alerts" from "anon";

revoke update on table "public"."toxicity_alerts" from "anon";

revoke delete on table "public"."toxicity_alerts" from "authenticated";

revoke insert on table "public"."toxicity_alerts" from "authenticated";

revoke references on table "public"."toxicity_alerts" from "authenticated";

revoke select on table "public"."toxicity_alerts" from "authenticated";

revoke trigger on table "public"."toxicity_alerts" from "authenticated";

revoke truncate on table "public"."toxicity_alerts" from "authenticated";

revoke update on table "public"."toxicity_alerts" from "authenticated";

revoke delete on table "public"."toxicity_alerts" from "service_role";

revoke insert on table "public"."toxicity_alerts" from "service_role";

revoke references on table "public"."toxicity_alerts" from "service_role";

revoke select on table "public"."toxicity_alerts" from "service_role";

revoke trigger on table "public"."toxicity_alerts" from "service_role";

revoke truncate on table "public"."toxicity_alerts" from "service_role";

revoke update on table "public"."toxicity_alerts" from "service_role";

revoke delete on table "public"."toxicity_assessments" from "anon";

revoke insert on table "public"."toxicity_assessments" from "anon";

revoke references on table "public"."toxicity_assessments" from "anon";

revoke select on table "public"."toxicity_assessments" from "anon";

revoke trigger on table "public"."toxicity_assessments" from "anon";

revoke truncate on table "public"."toxicity_assessments" from "anon";

revoke update on table "public"."toxicity_assessments" from "anon";

revoke delete on table "public"."toxicity_assessments" from "authenticated";

revoke insert on table "public"."toxicity_assessments" from "authenticated";

revoke references on table "public"."toxicity_assessments" from "authenticated";

revoke select on table "public"."toxicity_assessments" from "authenticated";

revoke trigger on table "public"."toxicity_assessments" from "authenticated";

revoke truncate on table "public"."toxicity_assessments" from "authenticated";

revoke update on table "public"."toxicity_assessments" from "authenticated";

revoke delete on table "public"."toxicity_assessments" from "service_role";

revoke insert on table "public"."toxicity_assessments" from "service_role";

revoke references on table "public"."toxicity_assessments" from "service_role";

revoke select on table "public"."toxicity_assessments" from "service_role";

revoke trigger on table "public"."toxicity_assessments" from "service_role";

revoke truncate on table "public"."toxicity_assessments" from "service_role";

revoke update on table "public"."toxicity_assessments" from "service_role";

alter table "public"."toxicity_alerts" drop constraint "toxicity_alerts_acknowledged_by_fkey";

alter table "public"."toxicity_alerts" drop constraint "toxicity_alerts_assessment_id_fkey";

alter table "public"."toxicity_alerts" drop constraint "toxicity_alerts_institution_id_fkey";

alter table "public"."toxicity_alerts" drop constraint "toxicity_alerts_patient_id_fkey";

alter table "public"."toxicity_assessments" drop constraint "toxicity_assessments_assessed_by_fkey";

alter table "public"."toxicity_assessments" drop constraint "toxicity_assessments_events_check";

alter table "public"."toxicity_assessments" drop constraint "toxicity_assessments_institution_id_fkey";

alter table "public"."toxicity_assessments" drop constraint "toxicity_assessments_patient_id_fkey";

alter table "public"."toxicity_assessments" drop constraint "toxicity_cycle_by_type_check";

alter table "public"."toxicity_alerts" drop constraint "toxicity_alerts_pkey";

alter table "public"."toxicity_assessments" drop constraint "toxicity_assessments_pkey";

drop index if exists "public"."idx_toxicity_alerts_patient_pending";

drop index if exists "public"."idx_toxicity_assessments_institution";

drop index if exists "public"."idx_toxicity_assessments_patient_date";

drop index if exists "public"."toxicity_alerts_pkey";

drop index if exists "public"."toxicity_assessments_pkey";

drop table "public"."toxicity_alerts";

drop table "public"."toxicity_assessments";

alter table "public"."institutions" add column "invite_code" text;

alter table "public"."profiles" add column "is_active" boolean not null default true;

drop type "public"."toxicity_assessment_type";

CREATE UNIQUE INDEX institutions_invite_code_key ON public.institutions USING btree (invite_code);

alter table "public"."institutions" add constraint "institutions_invite_code_key" UNIQUE using index "institutions_invite_code_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.complete_signup_profile()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  meta jsonb;
  v_invite_code text;
  v_full_name text;
  v_role text;
  v_institution_id uuid;
begin
  -- Idempotent: if a profile already exists, do nothing and report success.
  if exists (select 1 from profiles where id = auth.uid()) then
    return jsonb_build_object('status', 'already_exists');
  end if;

  select raw_user_meta_data into meta from auth.users where id = auth.uid();

  v_invite_code := meta->>'invite_code';
  v_full_name := meta->>'full_name';
  v_role := meta->>'role';

  if v_invite_code is null or v_invite_code = '' then
    raise exception 'No invite code was provided at signup.';
  end if;

  select id into v_institution_id from institutions where invite_code = v_invite_code;

  if v_institution_id is null then
    raise exception 'Invite code % does not match any institution.', v_invite_code;
  end if;

  insert into profiles (id, institution_id, full_name, role, credential_verified)
  values (
    auth.uid(),
    v_institution_id,
    coalesce(v_full_name, 'New User'),
    coalesce(v_role, 'physician')::user_role,
    false
  );

  return jsonb_build_object('status', 'created', 'institution_id', v_institution_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_institution_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select institution_id from profiles where id = auth.uid() and is_active = true;
$function$
;


  create policy "profiles_update_by_admin"
  on "public"."profiles"
  as permissive
  for update
  to public
using (((institution_id = public.current_institution_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::public.user_role))))))
with check ((institution_id = public.current_institution_id()));



