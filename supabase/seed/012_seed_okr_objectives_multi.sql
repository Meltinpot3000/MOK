-- 012_seed_okr_objectives_multi.sql
-- Ca. 20 OKR-Ziele mit Strategie-Ziel, Stossrichtungs-Link und je 2 Key Results (cabtecgroup).
-- Verteilt auf mehrere Memberships und Stossrichtungen der aktiven cycle_instance. Idempotent.
-- migrate:up

create extension if not exists pgcrypto;

do $$
declare
  v_org_id uuid;
  v_ci uuid;
  v_pc uuid;
  v_admin uuid;
  v_okr uuid;
  v_dir_ids uuid[];
  v_mems uuid[];
  n_dir int;
  n_mem int;
  sid uuid;
  oid uuid;
  v_dir uuid;
  v_owner uuid;
  r record;
  u record;
  v_uid uuid;
  v_mid uuid;
  v_rid uuid;
begin
  select id into v_org_id from app.organizations where slug = 'cabtecgroup' limit 1;

  if v_org_id is null then
    raise notice '012_seed_okr_multi: Organisation cabtecgroup nicht gefunden — uebersprungen.';
    return;
  end if;

  select id into v_admin
  from app.organization_memberships
  where organization_id = v_org_id and status = 'active'
  order by hierarchy_level asc nulls last, created_at asc
  limit 1;

  for u in
    select * from (values
      ('demo.product@cabtecgroup.demo'::text, 'team_member'::text, 3::int, 'Produktmanagement'::text, 'Lea Kesselberg'::text),
      ('demo.engineering@cabtecgroup.demo'::text, 'team_member'::text, 3::int, 'Entwicklungsplanung'::text, 'Milan Richter'::text),
      ('demo.quality@cabtecgroup.demo'::text, 'team_member'::text, 3::int, 'Qualitaetsplanung'::text, 'Ina Bohm'::text),
      ('demo.finance@cabtecgroup.demo'::text, 'team_member'::text, 3::int, 'Controlling'::text, 'Oskar Wendt'::text)
    ) as t(email, role_code, hl, job_title, display_name)
  loop
    v_uid := null;
    v_mid := null;
    v_rid := null;

    select id into v_uid from auth.users where lower(email) = lower(u.email) limit 1;
    if v_uid is null then
      v_uid := gen_random_uuid();
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
      )
      values (
        v_uid,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        lower(u.email),
        crypt('TempDemo!2026', gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', u.display_name),
        false,
        false
      );
      insert into auth.identities (id, user_id, identity_data, provider, provider_id, created_at, updated_at)
      values (
        gen_random_uuid(),
        v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', lower(u.email)),
        'email',
        v_uid::text,
        now(),
        now()
      );
    end if;

    insert into app.organization_memberships (
      organization_id, user_id, status, hierarchy_level, title, display_name
    )
    values (
      v_org_id, v_uid, 'active',
      u.hl, u.job_title, u.display_name
    )
    on conflict (organization_id, user_id) do update
    set status = excluded.status,
        hierarchy_level = excluded.hierarchy_level,
        title = excluded.title,
        display_name = excluded.display_name
    returning id into v_mid;

    if v_mid is null then
      select id into v_mid
      from app.organization_memberships
      where organization_id = v_org_id and user_id = v_uid
      limit 1;
    end if;

    select id into v_rid from rbac.roles where organization_id = v_org_id and code = u.role_code limit 1;
    if v_rid is not null and v_mid is not null then
      insert into rbac.member_roles (membership_id, role_id)
      values (v_mid, v_rid)
      on conflict (membership_id, role_id) do nothing;
    end if;
  end loop;

  select ci.id, ci.legacy_planning_cycle_id
  into v_ci, v_pc
  from app.cycle_instances ci
  where ci.organization_id = v_org_id
  order by (ci.status = 'active') desc, ci.level_no desc, ci.starts_on desc
  limit 1;

  if v_pc is null then
    select id into v_pc
    from app.planning_cycles
    where organization_id = v_org_id
    order by start_date desc nulls last
    limit 1;
  end if;

  if v_ci is null or v_admin is null then
    raise notice '012_seed_okr_multi: cycle_instance oder Admin-Membership fehlt — uebersprungen.';
    return;
  end if;

  select id into v_okr
  from app.okr_cycles
  where organization_id = v_org_id
    and cycle_instance_id = v_ci
  order by (status = 'active') desc, start_date desc
  limit 1;

  if v_okr is null then
    raise notice '012_seed_okr_multi: kein OKR-Zyklus fuer cycle_instance — uebersprungen.';
    return;
  end if;

  select coalesce(array_agg(d.id order by d.priority, d.title), array[]::uuid[])
  into v_dir_ids
  from app.strategic_directions d
  where d.organization_id = v_org_id
    and d.cycle_instance_id = v_ci;

  if cardinality(v_dir_ids) = 0 then
    select coalesce(array_agg(d.id order by d.priority, d.title), array[]::uuid[])
    into v_dir_ids
    from app.strategic_directions d
    where d.organization_id = v_org_id
      and d.planning_cycle_id is not distinct from v_pc;
  end if;

  n_dir := cardinality(v_dir_ids);
  if n_dir = 0 then
    raise notice '012_seed_okr_multi: keine strategic_directions — uebersprungen.';
    return;
  end if;

  select coalesce(array_agg(x.id order by x.ord), array[]::uuid[])
  into v_mems
  from (
    select om.id,
      min(
        case lower(u.email)
          when 'demo.executive@cabtecgroup.demo' then 1
          when 'demo.fachbereich@cabtecgroup.demo' then 2
          when 'carmelo.messina@cabtecgroup.com' then 3
          when 'demo.team@cabtecgroup.demo' then 4
          when 'demo.product@cabtecgroup.demo' then 5
          when 'demo.engineering@cabtecgroup.demo' then 6
          when 'demo.quality@cabtecgroup.demo' then 7
          when 'demo.finance@cabtecgroup.demo' then 8
          else 900
        end
      ) as ord
    from app.organization_memberships om
    join auth.users u on u.id = om.user_id
    where om.organization_id = v_org_id
      and om.status = 'active'
    group by om.id
  ) x;

  n_mem := coalesce(cardinality(v_mems), 0);
  if n_mem = 0 then
    v_mems := array[v_admin];
    n_mem := 1;
  end if;

  delete from app.okr_objectives o
  where o.organization_id = v_org_id
    and o.title like '[OKR-Multi-Seed]%';

  delete from app.strategy_objectives s
  where s.organization_id = v_org_id
    and s.title like '[OKR-Multi-Seed]%';

  for r in
    select *
    from (
      values
        (1,
          'Kundenzufriedenheit und Lieferzuverlaessigkeit zur Markenstaerke ausbauen',
          'OTIF in den Top-3 Schlüsselkonten nachhaltig verbessern',
          'OTIF-Quote Schlüsselkunden (gewichtet)', 'percent'::text, 82::numeric, 94::numeric, 88::numeric,
          'Schwere Reklamationen pro Monat', 'numeric'::text, 6::numeric, 2::numeric, 4::numeric,
          4::smallint
        ),
        (2,
          'Operative Exzellenz in der Konfektion als Wettbewerbsvorteil verankern',
          'Durchlaufzeit von der AV bis Produktionsfreigabe reduzieren',
          'Median Durchlaufzeit AV bis Freigabe', 'numeric'::text, 12::numeric, 7::numeric, 10::numeric,
          'Anteil AV mit vollstaendigem Erstpacket (Tag 0)', 'percent'::text, 58::numeric, 85::numeric, 67::numeric,
          3::smallint
        ),
        (3,
          'Qualitaetskultur: Fehler vor der Linie verhindern, nicht nur entdecken',
          'FTQ in Serienanlauf fuer neue Teilenummern steigern',
          'FTQ erste 30 Serientage (NE)', 'percent'::text, 91::numeric, 97::numeric, 93::numeric,
          'Kosten fuer Nacharbeit (Shopfloor) vs Budget', 'percent'::text, 108::numeric, 96::numeric, 103::numeric,
          3::smallint
        ),
        (4,
          'Supply Resilience fr kritische Kontakt- und Leitungsteile sicherstellen',
          'Lieferausfallrisiken bei Class-A Teilen reduzieren',
          'Class-A Positionen mit validiertem Zweitwerk', 'percent'::text, 64::numeric, 92::numeric, 78::numeric,
          'Liefertreue bei Class-A (OTIF Rohmaterial)', 'percent'::text, 79::numeric, 93::numeric, 86::numeric,
          4::smallint
        ),
        (5,
          'Digitalisierung: Transparenz von Auftrag bis Auslieferung',
          'Shopfloor-Sichtbarkeit und Rueckmeldung in Echtzeit etablieren',
          'Aktive Shopfloor-Terminals (Anlagen mit Live-Rueckmeldung)', 'numeric'::text, 14::numeric, 36::numeric, 22::numeric,
          'Offene Abweichungen ohne Ticket (aelter 48h)', 'numeric'::text, 31::numeric, 8::numeric, 19::numeric,
          3::smallint
        ),
        (6,
          'Engineering-Rechner: Wiederverwendbare Module statt Einzelloesungen',
          'Anteil standardisierter Baugruppen am Neugeschaeft erhoehen',
          'Neukunden mit mind. 45 Prozent Standard-Baukasten-Komponenten', 'percent'::text, 28::numeric, 55::numeric, 38::numeric,
          'Wiederverwendungsscores in AV-Dokumenten (Durchschnitt)', 'numeric'::text, 2.1::numeric, 3.8::numeric, 3.0::numeric,
          3::smallint
        ),
        (7,
          'Nachhaltigkeit entlang Scope 2 und Verpackung messbar verbessern',
          'Energie- und Verpackungs-Footprint im Werk senken',
          'Stromkosten pro produzierte Einheit (Index)', 'percent'::text, 100::numeric, 91::numeric, 96::numeric,
          'Recyclingfaehige Verpackungsanteile (Gewicht)', 'percent'::text, 41::numeric, 62::numeric, 50::numeric,
          3::smallint
        ),
        (8,
          'People: Fachkraeftegewinnung und schnelleres Onboarding',
          'Time-to-Productivity in Produktion und QS verbessern',
          'Median Produktivitaet neuer Mitarbeitende Woche 8 (Index)', 'percent'::text, 100::numeric, 115::numeric, 106::numeric,
          'Offene kritische Rollen (Engineering/QS) > 60 Tage', 'numeric'::text, 9::numeric, 3::numeric, 6::numeric,
          3::smallint
        ),
        (9,
          'Regulatorik und Export: Zoll- und Pruefprozesse industrialisieren',
          'Fehlerquote bei Exportdokumenten minimieren',
          'Export-Vorgaenge ohne Nachbearbeitung (First-Pass)', 'percent'::text, 71::numeric, 92::numeric, 83::numeric,
          'Durchschnittliche Klärzeit Zollabweichungen (Tage)', 'numeric'::text, 6.2::numeric, 2.5::numeric, 4.1::numeric,
          3::smallint
        ),
        (10,
          'IT/Cyber: Resilienz der Produktionssysteme',
          'Backup-/Recovery-Faehigkeit fuer kritische MES/AV-Systeme nachweisen',
          'Recovery Time Objective Uebungen bestanden (kritisch)', 'numeric'::text, 1::numeric, 4::numeric, 2::numeric,
          'Kritische offene Security-Findings > 30 Tage', 'numeric'::text, 12::numeric, 2::numeric, 6::numeric,
          4::smallint
        ),
        (11,
          'Vertrieb: Rentables Wachstum im Rahmen- und Projektgeschaeft',
          'Pipeline-Qualitaet und Win-Rate in Zielsegmenten heben',
          'Gewichtete Pipeline Deckungsbeitrag (Zielsegment)', 'numeric'::text, 2.4::numeric, 3.6::numeric, 3.0::numeric,
          'Win-Rate qualifizierte Ausschreibungen', 'percent'::text, 22::numeric, 33::numeric, 27::numeric,
          4::smallint
        ),
        (12,
          'Finance: Working Capital ohne Lieferzuverlaessigkeit zu schmaelern',
          'Lager- und Forderungsoptimierung mit OTIF-Schutz',
          'Net Working Capital in Tagen (inventarisierte Position)', 'numeric'::text, 58::numeric, 49::numeric, 54::numeric,
          'Altbestaende > 180 Tage (Wert)', 'percent'::text, 9.2::numeric, 5.5::numeric, 7.4::numeric,
          3::smallint
        ),
        (13,
          'Test und Messtechnik: Kapazitaet fuer 100-Pruefung skalieren',
          'Engpaesse in Hochvol-Pruefung beseitigen',
          'Auslastung kritischer Pruefplaetze (Peak-Woche)', 'percent'::text, 96::numeric, 82::numeric, 89::numeric,
          'Rueckstau Lose warten auf Freigabe-Test (Stunden)', 'numeric'::text, 38::numeric, 12::numeric, 24::numeric,
          3::smallint
        ),
        (14,
          'Partnerschaften: strategische Werkzeug- und Betriebsmittelpartner stabilisieren',
          'Ruestzeiten durch Werkzeugverfuegbarkeit reduzieren',
          'Ungeplante Stillstaende Werkzeug/ BM (Minuten/Maschinenwoche)', 'numeric'::text, 140::numeric, 55::numeric, 95::numeric,
          'Werkzeuge mit validiertem Lebenszyklusplan', 'percent'::text, 52::numeric, 88::numeric, 71::numeric,
          3::smallint
        ),
        (15,
          'Kunde & Produkt: UL-Zertifizierung im Kernportfolio voranbringen',
          'Relevante Produktfamilien zertifizieren und pflegen',
          'UL-relevante Familien mit aktuellem Zertifikat', 'percent'::text, 67::numeric, 92::numeric, 79::numeric,
          'Audit-Findings mit Ueberfaelligkeit 0 (UL)', 'numeric'::text, 5::numeric, 0::numeric, 2::numeric,
          4::smallint
        ),
        (16,
          'Sicherheit am Arbeitsplatz: Vorschlagsmanagement und Near-Miss',
          'Kultur der Meldung staerken, schwere Zwischenfaelle vermeiden',
          'Eingereichte sinnvolle Sicherheitsvorschlaege pro Quartal', 'numeric'::text, 14::numeric, 45::numeric, 28::numeric,
          'Schwere Beinahe-Unfaelle ohne CAPA-Abschluss > 14 Tage', 'numeric'::text, 8::numeric, 1::numeric, 4::numeric,
          3::smallint
        ),
        (17,
          'Datenbasis: Stammdatenqualitaet in AV und ERP gegen Zielbild',
          'Datenqualitaetsindex Stammdaten verbessern',
          'Stammdatenqualitaetsindex (gewichtet)', 'percent'::text, 73::numeric, 90::numeric, 81::numeric,
          'Abweichende AV-Saetze ohne Ticket (Rolling 7d)', 'numeric'::text, 220::numeric, 80::numeric, 150::numeric,
          3::smallint
        ),
        (18,
          'Value Engineering: Materialkosten ohne Qualitaetsregression senken',
          'Kosten-Ziele bei Serienfreigaben erreichen',
          'Materialkostenindex Neu-Teile (Ziel-Linie)', 'percent'::text, 100::numeric, 94::numeric, 97::numeric,
          'Genehmigte Materialsubstitutionen mit QS-Sign-off', 'numeric'::text, 3::numeric, 18::numeric, 9::numeric,
          3::smallint
        ),
        (19,
          'Programm- und Portfoliomanagement: strategische Initiativen steuern',
          'Top-Initiativen im gruenem Zustand halten',
          'Top-12 Initiativen mit Ampelstatus gruen', 'numeric'::text, 6::numeric, 11::numeric, 8::numeric,
          'Ueberfaellige Meilensteine (krit. Pfad)', 'numeric'::text, 14::numeric, 4::numeric, 9::numeric,
          4::smallint
        ),
        (20,
          'Innovation: Rapid Prototyping fuer Kundenpiloten beschleunigen',
          'Piloten von Erstmuster bis validierter Serie unter 10 Wochen',
          'Median Pilotdauer (Kalenderwochen)', 'numeric'::text, 13.6::numeric, 9.5::numeric, 11.2::numeric,
          'Pilote mit dokumentiertem Lessons-Learned', 'percent'::text, 40::numeric, 90::numeric, 68::numeric,
          4::smallint
        )
    ) as t(
      seq int,
      strat_title text,
      okr_title text,
      kr1_title text,
      kr1_metric text,
      kr1_sv numeric,
      kr1_tv numeric,
      kr1_cv numeric,
      kr2_title text,
      kr2_metric text,
      kr2_sv numeric,
      kr2_tv numeric,
      kr2_cv numeric,
      imp smallint
    )
  loop
    sid := gen_random_uuid();
    oid := gen_random_uuid();
    v_dir := v_dir_ids[1 + ((r.seq - 1) % n_dir)];
    v_owner := v_mems[1 + ((r.seq - 1) % n_mem)];

    insert into app.strategy_objectives (
      id,
      organization_id,
      cycle_id,
      cycle_instance_id,
      title,
      description,
      status,
      owner_membership_id,
      importance_score,
      time_horizon,
      created_by_membership_id,
      created_by_source,
      progress_percent
    )
    values (
      sid,
      v_org_id,
      v_pc,
      v_ci,
      '[OKR-Multi-Seed] ' || r.strat_title,
      'Automatisches Demo-Strategieziel (012_seed_okr_objectives_multi). Verknuepft mit Stossrichtung und OKR-Ziel.',
      'active',
      v_owner,
      r.imp,
      'mehrjaehrig',
      v_admin,
      'sentinel',
      0
    );

    insert into app.okr_objectives (
      id,
      organization_id,
      cycle_id,
      cycle_instance_id,
      okr_cycle_id,
      title,
      description,
      status,
      owner_membership_id,
      confidence_level,
      importance_score,
      time_horizon,
      created_by_membership_id,
      created_by_source
    )
    values (
      oid,
      v_org_id,
      v_pc,
      v_ci,
      v_okr,
      '[OKR-Multi-Seed] ' || r.okr_title,
      'Quartals-Ziel aus Seed 012; traegt zum Strategie-Ziel bei.',
      'active',
      v_owner,
      7,
      r.imp,
      'quarter',
      v_admin,
      'sentinel'
    );

    insert into app.okr_objective_strategy_objectives (okr_objective_id, strategy_objective_id)
    values (oid, sid);

    insert into app.strategic_direction_objective_links (
      organization_id,
      planning_cycle_id,
      cycle_instance_id,
      strategic_direction_id,
      strategy_objective_id,
      created_by_membership_id,
      contribution_level
    )
    values (
      v_org_id,
      v_pc,
      v_ci,
      v_dir,
      sid,
      v_admin,
      'high'
    )
    on conflict (cycle_instance_id, strategic_direction_id, strategy_objective_id) do nothing;

    insert into app.key_results (
      organization_id,
      okr_objective_id,
      title,
      metric_type,
      start_value,
      target_value,
      current_value,
      status,
      measurement_unit,
      owner_membership_id,
      created_by_membership_id,
      created_by_source
    )
    values
      (
        v_org_id,
        oid,
        r.kr1_title,
        r.kr1_metric,
        r.kr1_sv,
        r.kr1_tv,
        r.kr1_cv,
        'active',
        case r.kr1_metric when 'percent' then '%' else null end,
        v_owner,
        v_admin,
        'sentinel'
      ),
      (
        v_org_id,
        oid,
        r.kr2_title,
        r.kr2_metric,
        r.kr2_sv,
        r.kr2_tv,
        r.kr2_cv,
        'active',
        case r.kr2_metric when 'percent' then '%' else null end,
        v_owner,
        v_admin,
        'sentinel'
      );
  end loop;

  raise notice '012_seed_okr_multi: 20 OKR-Pakete eingefuegt (cabtecgroup).';
end
$$;

-- migrate:down
select 1;
