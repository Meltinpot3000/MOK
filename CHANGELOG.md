# Changelog

## 2026-03-15

### Added
- Neue Reiterstruktur unter `Aufbauorganisation` mit den Tabs `Aufbauorganisation`, `Verantwortliche`, `Industrien`, `Business Models` und `Operating Models`.
- Gemeinsame Tab-Komponente fuer alle betroffenen Seiten.
- Flexible Organisationshierarchie auf Basis von `organization_unit` und `organization_unit_type` inkl. rekursiver Verwaltung.
- Organisationsgraph als gemeinsames Panel in allen relevanten Reitern.
- Farbcodierte Graph-Overlays je Organisationseinheit fuer `RESP` (Verantwortliche), `IND` (Industrien) und `BM` (Business Models).
- Neue Backend-Verknuepfungen von Organisationseinheiten zu `Industrien` und `Business Models` (inkl. UI fuer Verknuepfen/Entfernen).
- Migration `0032_org_unit_dimension_links.sql` fuer die neuen Link-Tabellen.
- Migration `0033_responsible_assignment_role_de.sql` fuer deutsche Rollenbezeichnungen in Zuordnungen.

### Changed
- Sidebar bereinigt: `Verantwortliche`, `Industrien`, `Business Models` und `Operating Models` als direkte Menuepunkte entfernt; Einstieg ueber `Aufbauorganisation`.
- RBAC-/Zugriffspruefung auf den betroffenen Seiten konsolidiert.
- Verantwortlichen-Zuordnung robust gemacht (Upsert + Schema-Fallback fuer altes/neues Spaltenmodell).
- Rollenanzeige in der Verantwortlichen-Zuordnung auf deutsche Begriffe umgestellt.
- Verantwortlichenliste erweitert um sichtbare Organisationszugehoerigkeit inkl. Rolle pro Zuordnung.
- Graph-Layout korrigiert (bessere Zentrierung der oberen Ebene ueber den untergeordneten Einheiten).

### Fixed
- Fehlerbild bei fehlgeschlagener Person-zu-Organisation-Zuordnung behoben (klare Rueckmeldung und verlaessliche Persistierung).
- Inkonsistenzen zwischen altem und neuem Zuordnungsschema (`org_unit_id` vs. `organization_unit_id`) mit Fallback-Logik abgefangen.
- Migration-Backfill fuer deutsche Rollenbezeichnung angepasst, damit Trigger-/Cross-Org-Validierungen keine ungueltigen Datensaetze verarbeiten.

