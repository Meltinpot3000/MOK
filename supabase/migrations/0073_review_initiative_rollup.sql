-- 0073_review_initiative_rollup.sql
-- Reviewzyklus: Roll-up-Felder und Review-Aktivitaetszeitstempel auf Initiativen.
-- migrate:up

alter table app.initiatives
  add column if not exists weight integer not null default 3
    constraint initiatives_weight_review_check check (weight in (1, 2, 3, 5, 8)),
  add column if not exists progress_percent integer not null default 0
    constraint initiatives_progress_percent_review_check check (progress_percent >= 0 and progress_percent <= 100),
  add column if not exists last_review_update_at timestamptz;

comment on column app.initiatives.weight is 'Relative Gewichtung fuer gewichteten Stossrichtungsfortschritt im Reviewzyklus.';
comment on column app.initiatives.progress_percent is 'Manuell gepflegter Umsetzungsfortschritt 0–100 im Reviewzyklus.';
comment on column app.initiatives.last_review_update_at is 'Letztes bewusstes Review-Update (nicht technisches updated_at).';

-- migrate:down

alter table app.initiatives drop constraint if exists initiatives_progress_percent_review_check;
alter table app.initiatives drop constraint if exists initiatives_weight_review_check;
alter table app.initiatives drop column if exists last_review_update_at;
alter table app.initiatives drop column if exists progress_percent;
alter table app.initiatives drop column if exists weight;
