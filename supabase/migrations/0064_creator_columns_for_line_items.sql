-- 0064_creator_columns_for_line_items.sql
-- Ersteller-Spalte für alle Line Items: Kennzeichnung von Sentinel✨ vs. Benutzer.
-- migrate:up

-- 1. created_by_source: 'user' | 'sentinel' – Unterscheidung Mensch vs. Sentinel
-- 2. created_by_membership_id wo fehlend (objectives, key_results, analysis_item_link)

-- analysis_entries: created_by_source hinzufügen
alter table app.analysis_entries
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- strategic_challenges
alter table app.strategic_challenges
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- strategic_directions
alter table app.strategic_directions
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- objectives: created_by_membership_id + created_by_source
alter table app.objectives
  add column if not exists created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- key_results: created_by_membership_id + created_by_source
alter table app.key_results
  add column if not exists created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- initiatives
alter table app.initiatives
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- annual_targets
alter table app.annual_targets
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- analysis_item_link: created_by_membership_id + created_by_source
alter table app.analysis_item_link
  add column if not exists created_by_membership_id uuid references app.organization_memberships(id) on delete set null,
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- analysis_item_link_draft
alter table app.analysis_item_link_draft
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- analysis_challenge_candidates
alter table app.analysis_challenge_candidates
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- analysis_clusters
alter table app.analysis_clusters
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- analysis_gap_findings
alter table app.analysis_gap_findings
  add column if not exists created_by_source text not null default 'user'
  check (created_by_source in ('user', 'sentinel'));

-- migrate:down
alter table app.analysis_entries drop column if exists created_by_source;
alter table app.strategic_challenges drop column if exists created_by_source;
alter table app.strategic_directions drop column if exists created_by_source;
alter table app.objectives drop column if exists created_by_membership_id;
alter table app.objectives drop column if exists created_by_source;
alter table app.key_results drop column if exists created_by_membership_id;
alter table app.key_results drop column if exists created_by_source;
alter table app.initiatives drop column if exists created_by_source;
alter table app.annual_targets drop column if exists created_by_source;
alter table app.analysis_item_link drop column if exists created_by_membership_id;
alter table app.analysis_item_link drop column if exists created_by_source;
alter table app.analysis_item_link_draft drop column if exists created_by_source;
alter table app.analysis_challenge_candidates drop column if exists created_by_source;
alter table app.analysis_clusters drop column if exists created_by_source;
alter table app.analysis_gap_findings drop column if exists created_by_source;
