-- 0181_strategy_review_feedback_upsert.sql
-- Feedback: eine Zeile pro (Review, Subject, Actor); Speichern per Upsert inkl. Kommentar.

-- migrate:up

-- Duplikate zusammenführen: jüngstes Rating + jüngster nicht-leerer Kommentar behalten
with agg as (
  select
    review_id,
    subject_type,
    subject_id,
    actor_id,
    (array_agg(id order by created_at desc, id desc))[1] as keep_id,
    (array_agg(rating order by created_at desc, id desc)
      filter (where rating is not null))[1] as best_rating,
    (array_agg(comment order by created_at desc, id desc)
      filter (where comment is not null and btrim(comment) <> ''))[1] as best_comment
  from app.strategy_review_feedback_entries
  group by review_id, subject_type, subject_id, actor_id
)
update app.strategy_review_feedback_entries e
set
  rating = a.best_rating,
  comment = a.best_comment,
  updated_at = now()
from agg a
where e.id = a.keep_id;

delete from app.strategy_review_feedback_entries e
where not exists (
  select 1
  from (
    select (array_agg(id order by created_at desc, id desc))[1] as keep_id
    from app.strategy_review_feedback_entries
    group by review_id, subject_type, subject_id, actor_id
  ) k
  where k.keep_id = e.id
);

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_entries_actor_subject_uq;

alter table app.strategy_review_feedback_entries
  add constraint strategy_review_feedback_entries_actor_subject_uq
  unique (review_id, subject_type, subject_id, actor_id);

create or replace function app.save_strategy_review_feedback(
  p_review_id uuid,
  p_actor_membership_id uuid,
  p_feedback jsonb
)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_elem jsonb;
  v_subject_type text;
  v_subject_id uuid;
  v_rating text;
  v_comment text;
begin
  select organization_id into v_org from app.okr_reviews where id = p_review_id;
  if v_org is null then
    raise exception 'save_strategy_review_feedback: review not found';
  end if;

  if p_actor_membership_id is distinct from app._strategy_review_current_membership(v_org) then
    raise exception 'save_strategy_review_feedback: actor must be current user membership';
  end if;

  if not app.has_permission(v_org, 'strategy_review.feedback') then
    raise exception 'save_strategy_review_feedback: forbidden';
  end if;

  for v_elem in select * from jsonb_array_elements(coalesce(p_feedback -> 'entries', '[]'::jsonb))
  loop
    v_subject_type := v_elem ->> 'subject_type';
    v_subject_id := nullif(v_elem ->> 'subject_id', '')::uuid;
    v_rating := nullif(btrim(coalesce(v_elem ->> 'rating', '')), '');
    v_comment := nullif(btrim(coalesce(v_elem ->> 'comment', '')), '');

    if v_subject_id is null or v_subject_type is null then
      continue;
    end if;

    insert into app.strategy_review_feedback_entries (
      review_id, subject_type, subject_id, actor_id, rating, comment
    ) values (
      p_review_id, v_subject_type, v_subject_id, p_actor_membership_id, v_rating, v_comment
    )
    on conflict (review_id, subject_type, subject_id, actor_id)
    do update set
      rating = excluded.rating,
      comment = excluded.comment,
      updated_at = now();
  end loop;

  update app.okr_reviews r
  set stakeholder_feedback_payload = jsonb_build_object(
    'updated_at', to_jsonb(now()),
    'entry_count', (
      select count(*)::int
      from app.strategy_review_feedback_entries f
      where f.review_id = p_review_id
    )
  )
  where r.id = p_review_id;

  perform app.compute_review_readiness(p_review_id);
end;
$$;

-- migrate:down

create or replace function app.save_strategy_review_feedback(
  p_review_id uuid,
  p_actor_membership_id uuid,
  p_feedback jsonb
)
returns void
language plpgsql security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_elem jsonb;
  v_subject_type text;
  v_subject_id uuid;
  v_rating text;
  v_comment text;
begin
  select organization_id into v_org from app.okr_reviews where id = p_review_id;
  if v_org is null then
    raise exception 'save_strategy_review_feedback: review not found';
  end if;

  if p_actor_membership_id is distinct from app._strategy_review_current_membership(v_org) then
    raise exception 'save_strategy_review_feedback: actor must be current user membership';
  end if;

  if not app.has_permission(v_org, 'strategy_review.feedback') then
    raise exception 'save_strategy_review_feedback: forbidden';
  end if;

  for v_elem in select * from jsonb_array_elements(coalesce(p_feedback -> 'entries', '[]'::jsonb))
  loop
    v_subject_type := v_elem ->> 'subject_type';
    v_subject_id := nullif(v_elem ->> 'subject_id', '')::uuid;
    v_rating := v_elem ->> 'rating';
    v_comment := v_elem ->> 'comment';

    insert into app.strategy_review_feedback_entries (
      review_id, subject_type, subject_id, actor_id, rating, comment
    ) values (
      p_review_id, v_subject_type, v_subject_id, p_actor_membership_id, v_rating, v_comment
    );
  end loop;

  update app.okr_reviews r
  set stakeholder_feedback_payload = jsonb_build_object(
    'updated_at', to_jsonb(now()),
    'entry_count', (
      select count(*)::int
      from app.strategy_review_feedback_entries f
      where f.review_id = p_review_id
    )
  )
  where r.id = p_review_id;

  perform app.compute_review_readiness(p_review_id);
end;
$$;

alter table app.strategy_review_feedback_entries
  drop constraint if exists strategy_review_feedback_entries_actor_subject_uq;
