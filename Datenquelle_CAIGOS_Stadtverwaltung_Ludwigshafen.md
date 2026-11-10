# Datenquelle CAIGOS – Integrationskonzept für das zentrale Dashboard

**Projekt:** Zentrales Dashboard der Stadtverwaltung Ludwigshafen am Rhein  
**Dokumenttyp:** Datenquellen-Steckbrief und technisches Recherche-/Entscheidungsdokument  
**Stand:** 09.11.2026  
**Status:** Vorprüfung – lokale Installation, Rechte, Module und Schnittstellen noch nicht bestätigt  
**Priorität:** Hoch (potenzielle Hauptquelle für die interaktive Stadtkarte)

> **Einordnung:** Der Auftraggeber berichtet, dass in einer kartengestützten Anwendung, vermutlich CAIGOS, unter anderem Maßnahmen eingetragen werden. Die genaue Produktvariante und die konkrete Datenstruktur der Stadt sind noch nicht geprüft. Aussagen zu Funktionen des Herstellers sind keine Bestätigung ihrer Verfügbarkeit bei der Stadt Ludwigshafen.

## 1. Kurzfazit und empfohlener Integrationsweg

**Erste Wahl:** Einen bestehenden, intern erreichbaren und für die betroffenen Layer freigegebenen **WFS-Dienst** prüfen. Wenn der WFS auch die benötigten Fachdaten und stabilen Objektkennungen liefert, sollte der Dashboard-Backend-Adapter die Objekte **lesend und regelmäßig** abrufen, normalisieren und in einer separaten Dashboard-Datenbank zwischenspeichern. Für einen Proof of Concept kann ein Abrufintervall von **5 Minuten** getestet werden; das ist ein Vorschlag, keine zugesicherte Systemleistung.

**Fallback / schneller erster Nachweis:** Die vom Hersteller dokumentierte **CSV-Schnittstelle** für wiederholbare Exporte nutzen; für Geometrien gegebenenfalls einen zusätzlich freigegebenen Shape-Export oder ein Koordinatenfeld verwenden. Ein manueller CSV-Export ist zunächst **nicht live**. Automatisierung und Frequenz müssen gesondert geprüft werden.

**Alternative für hohen Aktualitätsbedarf:** **Lesender, abgestimmter Datenbankzugriff** auf freigegebene Views, gegebenenfalls auf eine Replik bzw. über eine Export-/Integrationsdatenbank. Dieser Weg bietet potenziell niedrige Latenz, ist aber stärker von Herstellerfreigabe, Datenbankschema, Berechtigungen und Betriebsverantwortung abhängig.

**Nicht als alleinige Datenintegration wählen:** **WMS** liefert vor allem gerenderte Kartenbilder und gegebenenfalls punktuelle Objektabfragen; für konsolidierte Statusauswertungen, Zählungen, Historie und Verknüpfungen sind strukturierte Features und Fachattribute erforderlich.

**Wichtig:** „Nahezu live“ bedeutet hier: möglichst kurze Verzögerung *nach Speicherung und Freigabe einer Änderung in der Quelle*. Dashboard-Aktualisierung, Dienst-Caching, Synchronisierung mobiler/offline erfasster Daten und Pflegeprozesse können die tatsächliche Aktualität begrenzen.

## 2. Rolle von CAIGOS im Zielsystem

CAIGOS ist ein Geoinformationssystem mit geografischen Objekten (Punkte, Linien, Flächen) und verbundenen Fachdaten. Für das Dashboard können – **sofern im konkreten kommunalen Bestand vorhanden und freigegeben** – beispielsweise Straßenbaumaßnahmen, baustellenbezogene Einträge, Infrastruktur-Objekte oder weitere thematische Layer relevant sein. Die vom Auftraggeber genannten *Maßnahmen* sind das erste konkrete Rechercheobjekt.

Das Dashboard soll CAIGOS **nicht ersetzen** und keine zweite Datenpflege einführen: Änderungen werden weiterhin im zuständigen Fachverfahren gepflegt, das Dashboard hält eine lesende, kontrollierte Kopie für Kartenansichten, bereichsübergreifende Zusammenführung und Lagebild-Kennzahlen vor.

## 3. Herstellerseitig dokumentierte Möglichkeiten – und Grenzen der Schlussfolgerungen

| Funktion | Öffentlich dokumentierte Grundlage | Was für Ludwigshafen noch zu klären ist |
|---|---|---|
| WMS-Bereitstellung | CAIGOS Geoportal beschreibt Bereitstellung von WMS-Diensten | Sind die relevanten internen Layer als WMS veröffentlicht? Welche Rechte, URL und Nutzungsbedingungen gelten? |
| WFS-Technologie | CAIGOS-Fachmaterialien und xPlanBox beschreiben WFS-Server/-Dienste für bestimmte Daten/Module | Ist für **Maßnahmen** ein WFS-Ausgabedienst vorhanden und lizenziert? Liefert er Attribute und Objekt-IDs? |
| CAIGOS Globe | Web-GIS mit Fach- und Geodaten im Browser; WMS/WFS-Einbindung externer Dienste dokumentiert | Eine Browseransicht oder das **Einbinden** eines WFS beweist nicht, dass CAIGOS-Daten nach außen per WFS **bereitgestellt** werden |
| CSV-Import/-Export | Hersteller dokumentiert wiederholbare CSV-Exporte inklusive Sachdaten und verbundener Tabellen | Welche Exportfunktion/Lizenz besteht, wie läuft sie unbeaufsichtigt, welche Felder/IDs sind enthalten? |
| Shape-Export | Hersteller dokumentiert Export von CAIGOS-Ebenen als Shape | Enthält dieser die gewünschten Geometrien/Attribute und ist er automatisierbar? |
| Datenbank | CAIGOS nutzt in verschiedenen Kontexten relationale Datenbanken; konkrete Installationsvarianten unterscheiden sich | DBMS, Schema, Integrationsfreigabe, sichere Views, Performance, Änderungslogik und Supportfähigkeit klären |

Die veröffentlichten Informationen belegen **keine allgemeine REST-API**, kein garantiert verfügbares Webhook-System, keine Change-Data-Capture-Schnittstelle und keinen Echtzeit-Push für die konkret eingesetzte Stadtinstallation. Solche Funktionen nicht voraussetzen.

## 4. Bewertung der Integrationsvarianten

| Weg | Nutzen | Einschränkungen | Empfehlung |
|---|---|---|---|
| **WFS → Adapter → Dashboard-DB** | Standardisierter, lesender Abruf von Geometrie und Attributen; regelmäßige Updates; klar abgegrenzter Zugang | Service muss Daten freigeben; Datenumfang, Paging, Filter, Cache, IDs, Änderungszeitpunkte prüfen | **Bevorzugt**, wenn Maßnahmen-Layer vollständig bereitsteht |
| **Freigegebene Datenbank-Views → Adapter** | Sehr flexible, gezielte Abfragen und potenziell geringe Verzögerung; komplexe Fachattribute | Vendor-Schema, Datenhoheit, Sicherheit und Aktualisierungslogik können Aufwand erhöhen; Risiko für Produktionssystem | **Zweite Wahl** bzw. bei echtem Mehrwert nach IT-/Herstellerprüfung |
| **Zeitgesteuerter CSV-/Geodatenexport** | Niedrige Einstiegshürde; gut testbar; leicht zu protokollieren | Nicht automatisch live; Exportprozess und Geometrien klären; Vollimporte können teuer sein | **Fallback und PoC-Pfad** |
| **WMS-Einbindung** | Schnell eine Kartenebene sichtbar machen | Für strukturierte Zusammenführung meist unzureichend; GetFeatureInfo optional und nicht als Voll-API ansehen | **Ergänzend** für kartografische Darstellung |
| **Screenscraping / Browser-Automation** | Allenfalls bei fehlender Schnittstelle | Fragil, anfällig für UI-Updates und Berechtigungsprobleme | **Nicht bevorzugen** |

**Entscheidungskriterium:** Nicht die vermeintlich „modernste“ Schnittstelle gewinnt, sondern die Variante, die **alle für Maßnahmen benötigten IDs, Geometrien, Status- und Zeitfelder** zuverlässig und mit vertretbarem Aufwand unter genehmigten Berechtigungen bereitstellt.

## 5. Technische Zielarchitektur

```text
CAIGOS (führendes Fachverfahren)
    │
    ├─ bevorzugt: interner WFS-Dienst (Feature- und Attributdaten)
    ├─ alternativ: freigegebene lesende Datenbank-Views
    └─ Fallback: wiederkehrender CSV-/Shape-Export
    │
    ▼
CAIGOS-Quelladapter (separates Integrationsmodul)
    ├─ Authentifizierung / Verbindungsprüfung
    ├─ Abfrage nach Intervall bzw. Änderungsstand
    ├─ Pagination, Retries, Timeout, Fehlerisolierung
    ├─ Validierung, ID-Mapping, Koordinatenumwandlung
    └─ Importprotokoll und Aktualitäts-Metadaten
    │
    ▼
Dashboard-Datenbank (z. B. PostgreSQL + PostGIS)
    ├─ Roh-/Quellabbild der Datensätze
    ├─ Normalisierte Objekte und Geometrien
    ├─ Quell-ID, fachliche Herkunft, Aktualisierungszeit
    └─ Zuordnung zu anderen Datenquellen
    │
    ▼
Dashboard-Backend-API
    ├─ Abteilungsansichten
    ├─ Interaktive Stadtkarte / Feature-Details
    └─ Übergreifende Kennzahlen / Wallboard
```

**Keine direkte Verbindung vom Browser zur internen CAIGOS-Datenbank.** Die Integrationsschicht verwaltet Zugangsdaten serverseitig, isoliert Quellstörungen und gewährleistet konsistente Rechte und Cache-Strategien.

## 6. Aktualitätskonzept und Proof of Concept

Für den ersten Test wird folgendes **unverbindliche Zielbild** vorgeschlagen:

| Bestandteil | Testannahme | Bedingung |
|---|---|---|
| Quellabruf | Alle 5 Minuten | Nur nach Last-/Betriebsfreigabe |
| Dashboard-Frontend | Regelmäßiger Refresh oder Push bei neuen importierten Daten | Frontend-Refresh aktualisiert nicht die Quelle selbst |
| Staleness-Warnung | Nach z. B. 15 Minuten ohne erfolgreichen Abgleich | Grenzwerte nach Fachlichkeit definieren |
| Maximal tolerierte Verzögerung | Erst nach Messung festlegen | Quelle, Caches, Exporte und Verarbeitungszeit berücksichtigen |

**Testablauf:** (1) Einen freigegebenen Maßnahmen-Layer auswählen. (2) Einen Datensatz mit stabiler Kennung identifizieren. (3) Nach vereinbarter Teständerung die Zeit bis zur Verfügbarkeit über den Dienst messen. (4) Den Dashboard-Adapter laufen lassen, korrektes Upsert/Update/Löschen und den Zeitstempel prüfen. (5) Ausfälle, Mehrfachabrufe, fehlerhafte Koordinaten und Berechtigungsschranken testen.

**Synchronisierung:** Wo vorhanden, serverseitige Änderungszeitstempel oder inkrementelle Filter verwenden. Andernfalls mit paginiertem vollständigem Abgleich beginnen und Objekte anhand stabiler IDs und Prüfsummen vergleichen. Nicht gefundene Objekte **nicht vorschnell löschen**, bevor Paging, Filter, temporäre Fehler und Freigabeänderungen ausgeschlossen wurden.

**Anzeige:** Jeden Datensatz möglichst mit `source_updated_at`, `last_successful_sync_at` und `sync_status` kennzeichnen. Die genaue Feldverfügbarkeit steht noch nicht fest. Auf der Karte und dem Wallboard den Datenstand sichtbar machen.

## 7. Mindestfelder für einen Maßnahmen-Datensatz (Sollmodell, nicht verifiziert)

- `source_system`: CAIGOS
- `source_object_id`: stabile CAIGOS-interne Objektkennung
- `object_type`: z. B. Maßnahme
- `title` / `description`: Name und Beschreibung, falls vorhanden
- `category` / `status`: Art und Zustand, falls vorhanden
- `planned_start` / `planned_end`: Terminangaben, falls vorhanden
- `geometry`: Punkt, Linie oder Polygon einschließlich Koordinatenreferenzsystem
- `department` / `responsible_unit`: zuständige Organisation, falls vorhanden und freigegeben
- `source_updated_at`: Änderungszeit in CAIGOS, falls verfügbar
- `last_successful_sync_at`: Zeitpunkt des erfolgreichen Dashboard-Abgleichs
- `provenance`: Datenquelle, Layer und Zuordnungs-/Transformationsregeln

Diese Felder sind **Anforderungen an den Adapter**, keine Behauptung über vorhandene CAIGOS-Spalten. Ein Vorab-Abgleich gegen realen Export oder WFS-Schema ist Pflicht. Für quellenübergreifende Zusammenführung ist zusätzlich eine geprüfte ID-/Matching-Strategie nötig.

## 8. Konkrete Fragen an GIS-Administration und IT

1. Welche **CAIGOS-Version**, Module und Betriebsform nutzt die Stadt (Desktop, Globe, Geoportal, Fachmodule)?
2. Wo werden die eingetragenen **Maßnahmen** geführt? Wie heißen Fachanwendung, Layer/Tabelle und Zuständigkeit?
3. Existiert ein **WFS-Server**, der diesen Layer **ausgeben** kann (nicht nur externen WFS einlesen)? Ist er intern erreichbar?
4. Falls ja: Endpunkt, WFS-Version, `GetCapabilities`, Feature-Typ, Authentifizierung, Paging-/Filtermöglichkeiten und erlaubte Abrufintervalle?
5. Liefert der WFS **Geometrie, stabile ID, Status, Termine, Beschreibung und Änderungszeit**? Wie werden gelöschte/archivierte Einträge erkannt?
6. Falls WFS nicht passt: Ist ein **zeitgesteuerter CSV-/Shape-Export** möglich, wohin wird geliefert und wie häufig?
7. Wäre alternativ ein **read-only Datenbank-View** für genau diese Felder zulässig und vom Hersteller unterstützt? Gibt es eine Replik?
8. Welche Daten sind abteilungsübergreifend freigegeben? Bestehen personenbezogene oder sicherheitsrelevante Inhalte?
9. Welche Lizenz-, Last-, Netzwerk-, Betriebs- und Supportbedingungen gelten für automatische Fremdabfragen?
10. Welcher gemessene Aktualitätstakt ist fachlich notwendig (Minuten, Stunden, täglich)?

## 9. Vorgehen und Entscheidungspunkte

**Schritt A – Bestandsaufnahme:** GIS-Administrator und Maßnahmen-Fachbereich identifizieren; konkret verwendete CAIGOS-Variante und einen repräsentativen Layer aufnehmen.

**Schritt B – Schnelltest WFS:** Nur nach Freigabe Metadaten und 10–20 Beispieldatensätze abrufen; prüfen, ob IDs, Attributschema, Lage und Aktualisierung geeignet sind.

**Schritt C – Entscheidung:** Falls WFS die relevanten Daten strukturiert und aktuell genug liefert, diesen Weg wählen. Sonst innerhalb derselben Woche im fachlichen PoC einen CSV-/Geodatenexport als Zwischenlösung testen; bei hohen Anforderungen Datenbank-View gesondert evaluieren. (Zeitplanung nur illustrativ, nicht abgestimmt.)

**Schritt D – Implementierung:** Read-only-Adapter, Normalisierung, Fehlerprotokollierung, PostGIS-Speicherung, Kartenlayer und Detailpanel umsetzen; anschließend Last- und Änderungsprüfung.

**Schritt E – Betrieb:** Fachliche Freigaben, Rollen, Monitoring, Backups, Rate Limits und Abstimmung mit CAIGOS-Betrieb dokumentieren.

**Abnahmekriterium für den PoC:** Eine in CAIGOS angelegte oder geänderte Testmaßnahme erscheint auf der Dashboard-Karte mit korrekter Geometrie, ID, Attributen, Quellenhinweis und nachvollziehbarem Datenstand; Zeitverzug wird protokolliert. Eine Lösch-/Archivierungsänderung wird ebenfalls korrekt behandelt.

## 10. Quellen und Evidenz (öffentlich recherchiert)

1. CAIGOS, **Schnittstellen** – grundsätzliche Integrationsmöglichkeiten: https://www.caigos.de/produkte/schnittstellen/
2. CAIGOS, **CSV-Schnittstelle** – strukturierter Import/Export, speicherbare Exporteinstellungen: https://www.caigos.de/produkte/schnittstellen/csv-import-export/
3. CAIGOS, **Shape-Schnittstelle** – bidirektionaler Geodatenaustausch: https://www.caigos.de/produkte/schnittstellen/shape-import-export/
4. CAIGOS, **Geoportal** – dokumentierte WMS-Bereitstellung: https://www.caigos.de/produkte/portal/caigos-geoportal/
5. CAIGOS, **Globe** – browserbasiertes GIS, Einbindung von WMS/WFS (nicht mit Veröffentlichung gleichsetzen): https://www.caigos.de/produkte/betriebsmittel/caigos-globe/
6. CAIGOS, **xPlanBox** – WMS-/WFS-Bereitstellung für XPlanGML-Planwerke (modulspezifisch): https://www.caigos.de/produkte/stadtentwicklung-stadtplanung/xplanbox/

**Recherchegrenze:** Keine der Quellen belegt, dass in der Ludwigshafener CAIGOS-Instanz genau der Maßnahmenbestand über WFS, eine API oder einen automatischen Export erreichbar ist. Die technische Empfehlung ist daher eine **priorisierte Prüfstrategie**, keine verifizierte Anschlussanleitung.

## 11. Eintrag für das zentrale Datenquellen-Verzeichnis

| Feld | Wert |
|---|---|
| Quellen-ID | `caigos-gis` (vorgeschlagen) |
| System | CAIGOS GIS (konkrete Variante offen) |
| Verantwortliche | GIS-Administration / zuständiger Fachbereich: noch zu bestimmen |
| Dateninhalt | Kartografische Objekte und Fachattribute; **Maßnahmen** vom Auftraggeber genannt |
| Relevanz | Hoch für interaktive Karte und Maßnahmen-/Lagebildansichten |
| Bevorzugte Anbindung | Intern freigegebener WFS-Feature-Dienst, falls passend |
| Fallback | Geplanter CSV-/Shape-Export; optional freigegebene DB-Views |
| Datenrichtung | CAIGOS → Dashboard, nur lesend |
| Aktualitätsziel | Nach Messung festlegen; initialer Testvorschlag 5 Minuten |
| Reale Schnittstelle | **Noch unbestätigt** |
| Sicherheit / Freigabe | **Noch zu klären** |
| PoC-Status | **Nicht begonnen** |

---

**Merksatz:** Für das Dashboard ist die beste CAIGOS-Anbindung voraussichtlich ein **freigegebener Feature-/Fachdatenservice (WFS)** mit periodischem Import in die eigene Datenbank. Ein vorhandener Web-GIS-Client oder Kartenbilddienst alleine reicht für datengetriebene, quellenübergreifende Analysen nicht aus.
