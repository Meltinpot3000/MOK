-- 0095_org_okr_kr_owner_policy.sql
-- OKR: Organisation kann erzwingen, dass KR-Owner immer dem Objective-Owner entspricht.
-- migrate:up
alter table app.organizations
  add column if not exists okr_kr_owner_must_match_objective boolean not null default false;

comment on column app.organizations.okr_kr_owner_must_match_objective is
  'Wenn true: KR owner_membership_id wird an Objective-Owner gebunden (Planung ohne separates KR-Owner-Feld).';

-- migrate:down
alter table app.organizations
  drop column if exists okr_kr_owner_must_match_objective;
