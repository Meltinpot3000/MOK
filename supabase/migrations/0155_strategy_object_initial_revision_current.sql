-- migrate:up

-- Erstrevisionen mit draft waren in v_current_strategy_objects unsichtbar.
-- Nur revision_number = 1 ohne andere current-Revision anpassen.

update app.strategy_object_revisions r
set
  revision_state = 'current',
  updated_at = now()
where r.revision_number = 1
  and r.revision_state = 'draft'
  and not exists (
    select 1
    from app.strategy_object_revisions r2
    where r2.object_identity_id = r.object_identity_id
      and r2.id <> r.id
      and r2.revision_state = 'current'
  );

-- migrate:down

-- Datenfix nicht rueckgaengig machbar (draft vs current nicht rekonstruierbar).
select 1;
