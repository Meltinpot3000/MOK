-- 0061_llm_health_fallback_mode_gemini.sql
-- Groq primaer: Fallback-Modus kann jetzt "gemini" sein (statt nur groq/rule).
-- migrate:up

alter table app.llm_model_health_status
  drop constraint if exists llm_model_health_status_fallback_mode_check;

alter table app.llm_model_health_status
  add constraint llm_model_health_status_fallback_mode_check
  check (fallback_mode in ('none', 'groq', 'gemini', 'rule'));

-- migrate:down

update app.llm_model_health_status
  set fallback_mode = 'rule'
  where fallback_mode = 'gemini';

alter table app.llm_model_health_status
  drop constraint if exists llm_model_health_status_fallback_mode_check;

alter table app.llm_model_health_status
  add constraint llm_model_health_status_fallback_mode_check
  check (fallback_mode in ('none', 'groq', 'rule'));
