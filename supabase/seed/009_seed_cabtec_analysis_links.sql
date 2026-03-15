-- 009_seed_cabtec_analysis_links.sql
-- Seed draft and approved analysis links for tenant cabtecgroup.
-- migrate:up
do $$
declare
  v_org_id uuid;
  v_cycle_id uuid;
  v_membership_id uuid;
begin
  select id into v_org_id
  from app.organizations
  where slug = 'cabtecgroup'
  limit 1;

  if v_org_id is null then
    raise notice 'cabtecgroup not found, skipping link seed.';
    return;
  end if;

  select id into v_cycle_id
  from app.planning_cycles
  where organization_id = v_org_id
  order by start_date desc nulls last, created_at desc
  limit 1;

  if v_cycle_id is null then
    raise notice 'No planning cycle for cabtecgroup, skipping link seed.';
    return;
  end if;

  select id into v_membership_id
  from app.organization_memberships
  where organization_id = v_org_id
    and status = 'active'
  order by hierarchy_level asc nulls last, created_at asc
  limit 1;

  with seed_links as (
    select *
    from (
      values
        (
          'KI-gestuetzte Entwicklung wird Branchenstandard',
          'Hohe Engineering-Kompetenz in komplexen Nischen',
          'supports',
          4::smallint,
          0.7900::numeric(5,4),
          'Digitale Toolchains staerken bestehende Engineering-Staerken.',
          0.66::numeric,
          0.82::numeric,
          0.18::numeric,
          true
        ),
        (
          'Fachkraeftemangel in Entwicklungsteams',
          'Durchlaufzeiten in Angebots- und Projektuebergabe zu hoch',
          'amplifies',
          4::smallint,
          0.7600::numeric(5,4),
          'Ressourcenengpaesse verstaerken Verzoegerungen in der Uebergabe.',
          0.58::numeric,
          0.73::numeric,
          0.21::numeric,
          true
        ),
        (
          'Anhaltender Kostendruck bei OEMs',
          'Asiatische Anbieter greifen mit aggressiven Preisen an',
          'amplifies',
          5::smallint,
          0.8100::numeric(5,4),
          'Externer Kostendruck und Preisangriffe verstaerken sich gegenseitig.',
          0.61::numeric,
          0.78::numeric,
          0.17::numeric,
          true
        ),
        (
          'Unklare Priorisierung im Portfolio',
          'Durchlaufzeiten in Angebots- und Projektuebergabe zu hoch',
          'causes',
          4::smallint,
          0.7200::numeric(5,4),
          'Zu viele parallele Themen verursachen Engpaesse in kritischen Prozessschritten.',
          0.56::numeric,
          0.69::numeric,
          0.22::numeric,
          true
        ),
        (
          'Wissensinseln in Spezialthemen',
          'Fachkraeftemangel in Entwicklungsteams',
          'amplifies',
          4::smallint,
          0.7400::numeric(5,4),
          'Wissenskonzentration macht Engpaesse bei Personal noch wirksamer.',
          0.59::numeric,
          0.72::numeric,
          0.19::numeric,
          false
        ),
        (
          'EU-Nachhaltigkeitsregulierung erhoeht Nachweisaufwand',
          'Produkthaftungsrisiken bei Embedded-Software steigen',
          'depends_on',
          3::smallint,
          0.6500::numeric(5,4),
          'Zusaetzliche Nachweispflichten haengen eng mit Haftungs- und Compliance-Anforderungen zusammen.',
          0.52::numeric,
          0.58::numeric,
          0.24::numeric,
          false
        ),
        (
          'Aufbau eines modularen Serviceportfolios',
          'Cross-funktionale Teams koennen Time-to-Market messbar senken',
          'supports',
          4::smallint,
          0.7000::numeric(5,4),
          'Modularisierung wird durch klar abgestimmte, cross-funktionale Teams beguenstigt.',
          0.57::numeric,
          0.68::numeric,
          0.20::numeric,
          false
        ),
        (
          'Beschleunigte Technologiewechsel koennen bestehende Kompetenzen entwerten',
          'Hohe Engineering-Kompetenz in komplexen Nischen',
          'contradicts',
          4::smallint,
          0.6900::numeric(5,4),
          'Schnelle Plattformwechsel koennen heutige Differenzierungsfaehigkeiten teilweise entwerten.',
          0.49::numeric,
          0.23::numeric,
          0.74::numeric,
          false
        )
    ) as t(
      source_title,
      target_title,
      link_type,
      strength,
      confidence,
      comment,
      proximity_score,
      support_score,
      repulsion_score,
      seed_approved
    )
  ),
  resolved as (
    select
      s.*,
      src.id as source_id,
      tgt.id as target_id
    from seed_links s
    join app.analysis_entries src
      on src.organization_id = v_org_id
      and src.planning_cycle_id = v_cycle_id
      and src.title = s.source_title
    join app.analysis_entries tgt
      on tgt.organization_id = v_org_id
      and tgt.planning_cycle_id = v_cycle_id
      and tgt.title = s.target_title
    where src.id <> tgt.id
  ),
  inserted_drafts as (
    insert into app.analysis_item_link_draft (
      organization_id,
      planning_cycle_id,
      source_analysis_item_id,
      target_analysis_item_id,
      link_type,
      strength,
      confidence,
      comment,
      origin,
      provider,
      model,
      prompt_version,
      status,
      created_by_membership_id,
      metadata
    )
    select
      v_org_id,
      v_cycle_id,
      r.source_id,
      r.target_id,
      r.link_type,
      r.strength,
      r.confidence,
      r.comment,
      'hybrid',
      'seed',
      'seed-v1',
      'analysis-link-v2',
      'draft',
      v_membership_id,
      jsonb_build_object(
        'seed_context', 'cabtec_analysis_network_v1',
        'triScores', jsonb_build_object(
          'proximityScore', r.proximity_score,
          'supportScore', r.support_score,
          'repulsionScore', r.repulsion_score
        )
      )
    from resolved r
    on conflict (planning_cycle_id, source_analysis_item_id, target_analysis_item_id, link_type)
    do update set
      strength = excluded.strength,
      confidence = excluded.confidence,
      comment = excluded.comment,
      metadata = excluded.metadata,
      provider = excluded.provider,
      model = excluded.model,
      prompt_version = excluded.prompt_version
    returning id, source_analysis_item_id, target_analysis_item_id, link_type
  )
  insert into app.analysis_item_link (
    organization_id,
    planning_cycle_id,
    source_analysis_item_id,
    target_analysis_item_id,
    link_type,
    strength,
    confidence,
    comment,
    source_draft_id,
    activated_by_membership_id,
    metadata
  )
  select
    v_org_id,
    v_cycle_id,
    r.source_id,
    r.target_id,
    r.link_type,
    r.strength,
    r.confidence,
    r.comment,
    d.id as source_draft_id,
    v_membership_id,
    jsonb_build_object(
      'seed_context', 'cabtec_analysis_network_v1',
      'triScores', jsonb_build_object(
        'proximityScore', r.proximity_score,
        'supportScore', r.support_score,
        'repulsionScore', r.repulsion_score
      )
    )
  from resolved r
  join inserted_drafts d
    on d.source_analysis_item_id = r.source_id
    and d.target_analysis_item_id = r.target_id
    and d.link_type = r.link_type
  where r.seed_approved = true
  on conflict (planning_cycle_id, source_analysis_item_id, target_analysis_item_id, link_type)
  do update set
    strength = excluded.strength,
    confidence = excluded.confidence,
    comment = excluded.comment,
    metadata = excluded.metadata;
end
$$;

-- migrate:down
-- Non-destructive: keep seeded link data.
select 1;
