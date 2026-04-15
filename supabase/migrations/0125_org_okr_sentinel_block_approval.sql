-- 0125_org_okr_sentinel_block_approval.sql
-- MVP: Mandantenschalter — Sentinel✨ darf Freigabe-Anfragen für OKR-Objectives blockieren.
-- migrate:up

alter table app.organizations
  add column if not exists okr_sentinel_can_block_approval_request boolean not null default false;

comment on column app.organizations.okr_sentinel_can_block_approval_request is
  'Wenn true: Freigabe-Anfrage für okr_objectives wird abgelehnt, sobald Sentinel (Contribution-Kanten «insufficient» oder KR-Matching «insufficient_context») Anlass sieht.';

-- migrate:down

alter table app.organizations drop column if exists okr_sentinel_can_block_approval_request;
