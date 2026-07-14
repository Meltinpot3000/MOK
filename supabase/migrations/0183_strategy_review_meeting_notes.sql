-- 0183_strategy_review_meeting_notes.sql
-- Meeting-Notizen am Strategie-Review (geteilte Session-Notizen).

-- migrate:up

alter table app.okr_reviews
  add column if not exists meeting_notes text not null default '';

comment on column app.okr_reviews.meeting_notes is
  'Geteilte Notizen aus dem Strategie-Review-Meeting (Phase 3).';

create or replace function app.save_strategy_review_meeting_notes(
  p_review_id uuid,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path to 'app', 'public'
as $$
declare
  v_org uuid;
  v_proc text;
  v_mid uuid;
  v_is_lead boolean;
begin
  select organization_id, procedure_status
  into v_org, v_proc
  from app.okr_reviews
  where id = p_review_id
    and review_mode = 'strategy_review';

  if v_org is null then
    raise exception 'save_strategy_review_meeting_notes: not found';
  end if;

  v_mid := app._strategy_review_current_membership(v_org);
  if v_mid is null then
    raise exception 'save_strategy_review_meeting_notes: no membership';
  end if;

  v_is_lead := exists (
    select 1
    from app.strategy_review_participants p
    where p.review_id = p_review_id
      and p.membership_id = v_mid
      and p.review_role = 'lead'
  );

  if not v_is_lead and not app.has_permission(v_org, 'strategy_review.moderate') then
    raise exception 'save_strategy_review_meeting_notes: forbidden';
  end if;

  if v_proc not in ('review_in_progress', 'decision_captured') then
    raise exception 'save_strategy_review_meeting_notes: unexpected procedure_status %', v_proc;
  end if;

  update app.okr_reviews
  set meeting_notes = coalesce(p_notes, '')
  where id = p_review_id;
end;
$$;

grant execute on function app.save_strategy_review_meeting_notes(uuid, text) to authenticated;

comment on function app.save_strategy_review_meeting_notes(uuid, text) is
  'Speichert Meeting-Notizen; nur Review-Leitung oder Moderate; Phase Meeting/Freigabe.';

-- migrate:down

revoke execute on function app.save_strategy_review_meeting_notes(uuid, text) from authenticated;
drop function if exists app.save_strategy_review_meeting_notes(uuid, text);

alter table app.okr_reviews drop column if exists meeting_notes;
