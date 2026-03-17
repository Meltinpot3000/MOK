-- 0045_industries_portfolio_share.sql
-- Add strategic portfolio share field for industries.
-- migrate:up

alter table if exists app.industries
  add column if not exists portfolio_share numeric(6,3);

-- migrate:down

alter table if exists app.industries
  drop column if exists portfolio_share;
