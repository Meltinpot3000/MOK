-- 0165_initiative_review_provenance.sql
-- Review-Maßnahmen: Provenance-Felder auf Initiativen (MVP-Hybrid, keine review_measures-Tabelle).
-- migrate:up

alter table app.initiatives
  add column if not exists origin_type text
    check (origin_type is null or origin_type in ('user', 'review_measure', 'sentinel'));

alter table app.initiatives
  add column if not exists origin_review_signal_type text;

alter table app.initiatives
  add column if not exists origin_review_cycle_id uuid
    references app.cycle_instances(id) on delete set null;

alter table app.initiatives
  add column if not exists origin_source_object_type text;

alter table app.initiatives
  add column if not exists origin_source_object_id uuid;

alter table app.initiatives
  add column if not exists origin_strategic_direction_id uuid
    references app.strategic_directions(id) on delete set null;

alter table app.initiatives
  add column if not exists origin_review_note text;

create index if not exists idx_initiatives_origin_review_cycle
  on app.initiatives (organization_id, origin_review_cycle_id)
  where origin_type = 'review_measure';

-- migrate:down

drop index if exists app.idx_initiatives_origin_review_cycle;

alter table app.initiatives drop column if exists origin_review_note;
alter table app.initiatives drop column if exists origin_strategic_direction_id;
alter table app.initiatives drop column if exists origin_source_object_id;
alter table app.initiatives drop column if exists origin_source_object_type;
alter table app.initiatives drop column if exists origin_review_cycle_id;
alter table app.initiatives drop column if exists origin_review_signal_type;
alter table app.initiatives drop column if exists origin_type;
