-- 0175_strategy_review_meeting_start_and_readiness.sql
-- Meeting-Start für Moderatoren jederzeit in Vorab-Phase;
-- Readiness über alle Review-Elemente (nicht nur Stoßrichtungen).

-- migrate:up

create or replace function app.compute_review_readiness(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
declare
  v_pre jsonb;
  v_total int;
  v_with_feedback int;
begin
  select pre_read_payload
  into v_pre
  from app.okr_reviews
  where id = p_review_id;

  if v_pre is null then
    return;
  end if;

  select count(*)::int
  into v_total
  from (
    select 'challenge'::text as subject_type, (x->>'id')::uuid as subject_id
    from jsonb_array_elements(coalesce(v_pre -> 'challenges', '[]'::jsonb)) x
    where x ? 'id' and nullif(x->>'id', '') is not null
    union
    select 'focus_area', (x->>'id')::uuid
    from jsonb_array_elements(coalesce(v_pre -> 'focus_areas', '[]'::jsonb)) x
    where x ? 'id' and nullif(x->>'id', '') is not null
    union
    select 'objective', (x->>'id')::uuid
    from jsonb_array_elements(coalesce(v_pre -> 'objectives', '[]'::jsonb)) x
    where x ? 'id' and nullif(x->>'id', '') is not null
    union
    select 'program', (x->>'id')::uuid
    from jsonb_array_elements(coalesce(v_pre -> 'programs', '[]'::jsonb)) x
    where x ? 'id' and nullif(x->>'id', '') is not null
  ) elems;

  if v_total = 0 then
    update app.okr_reviews
    set readiness_status = 'not_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
    return;
  end if;

  select count(*)::int
  into v_with_feedback
  from (
    select distinct f.subject_type, f.subject_id
    from app.strategy_review_feedback_entries f
    where f.review_id = p_review_id
      and f.rating is not null
      and (
        (f.subject_type = 'challenge' and f.subject_id in (
          select (x->>'id')::uuid
          from jsonb_array_elements(coalesce(v_pre -> 'challenges', '[]'::jsonb)) x
          where x ? 'id' and nullif(x->>'id', '') is not null
        ))
        or (f.subject_type = 'focus_area' and f.subject_id in (
          select (x->>'id')::uuid
          from jsonb_array_elements(coalesce(v_pre -> 'focus_areas', '[]'::jsonb)) x
          where x ? 'id' and nullif(x->>'id', '') is not null
        ))
        or (f.subject_type = 'objective' and f.subject_id in (
          select (x->>'id')::uuid
          from jsonb_array_elements(coalesce(v_pre -> 'objectives', '[]'::jsonb)) x
          where x ? 'id' and nullif(x->>'id', '') is not null
        ))
        or (f.subject_type = 'program' and f.subject_id in (
          select (x->>'id')::uuid
          from jsonb_array_elements(coalesce(v_pre -> 'programs', '[]'::jsonb)) x
          where x ? 'id' and nullif(x->>'id', '') is not null
        ))
      )
  ) rated;

  if v_with_feedback = 0 then
    update app.okr_reviews
    set readiness_status = 'not_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
  elsif v_with_feedback < v_total then
    update app.okr_reviews
    set readiness_status = 'partially_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
  else
    update app.okr_reviews
    set readiness_status = 'ready',
        procedure_status = case
          when procedure_status = 'pre_read_open' then 'ready_for_review'
          else procedure_status
        end
    where id = p_review_id;
  end if;
end;
$$;

create or replace function app.start_strategy_review_meeting(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_proc text;
begin
  select organization_id, procedure_status
  into v_org, v_proc
  from app.okr_reviews
  where id = p_review_id and review_mode = 'strategy_review';

  if v_org is null then
    raise exception 'start_strategy_review_meeting: not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'start_strategy_review_meeting: forbidden';
  end if;

  -- Moderator darf das Meeting in der Vorab-Phase jederzeit starten
  if v_proc not in ('pre_read_open', 'ready_for_review') then
    raise exception 'start_strategy_review_meeting: unexpected procedure_status %', v_proc;
  end if;

  update app.okr_reviews
  set procedure_status = 'review_in_progress'
  where id = p_review_id;
end;
$$;

-- migrate:down

create or replace function app.compute_review_readiness(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
declare
  v_pre jsonb;
  v_ids uuid[] := array[]::uuid[];
  v_total int;
  v_with_feedback int;
begin
  select pre_read_payload
  into v_pre
  from app.okr_reviews
  where id = p_review_id;

  if v_pre is null then
    return;
  end if;

  select coalesce(array_agg(distinct u), array[]::uuid[])
  into v_ids
  from (
    select (x->>'id')::uuid as u
    from jsonb_array_elements(coalesce(v_pre -> 'focus_areas', '[]'::jsonb)) x
    where x ? 'id'
  ) s
  where u is not null;

  v_total := cardinality(v_ids);

  if v_total = 0 then
    update app.okr_reviews
    set readiness_status = 'not_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
    return;
  end if;

  select count(distinct f.subject_id)
  into v_with_feedback
  from app.strategy_review_feedback_entries f
  where f.review_id = p_review_id
    and f.subject_type = 'focus_area'
    and f.subject_id = any (v_ids)
    and f.rating is not null;

  if v_with_feedback = 0 then
    update app.okr_reviews
    set readiness_status = 'not_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
  elsif v_with_feedback < v_total then
    update app.okr_reviews
    set readiness_status = 'partially_ready',
        procedure_status = case when procedure_status = 'ready_for_review' then 'pre_read_open' else procedure_status end
    where id = p_review_id;
  else
    update app.okr_reviews
    set readiness_status = 'ready',
        procedure_status = case
          when procedure_status = 'pre_read_open' then 'ready_for_review'
          else procedure_status
        end
    where id = p_review_id;
  end if;
end;
$$;

create or replace function app.start_strategy_review_meeting(p_review_id uuid)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_ready text;
  v_proc text;
  v_override boolean;
begin
  select organization_id, readiness_status, procedure_status, override_forced
  into v_org, v_ready, v_proc, v_override
  from app.okr_reviews
  where id = p_review_id and review_mode = 'strategy_review';

  if v_org is null then
    raise exception 'start_strategy_review_meeting: not found';
  end if;

  if not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'start_strategy_review_meeting: forbidden';
  end if;

  if not (
    (v_ready = 'ready' and v_proc = 'ready_for_review')
    or (v_override and v_proc in ('pre_read_open', 'ready_for_review'))
  ) then
    raise exception 'start_strategy_review_meeting: readiness / state guard failed';
  end if;

  update app.okr_reviews
  set procedure_status = 'review_in_progress'
  where id = p_review_id;
end;
$$;
