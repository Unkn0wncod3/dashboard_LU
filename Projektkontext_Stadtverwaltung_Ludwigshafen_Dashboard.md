# Projektkontext – Zentrales Dashboard der Stadtverwaltung Ludwigshafen

> **Zweck dieser Datei:** Dauerhafte Projektquelle („Project Source“) für Planung, Architektur, Entwicklung und spätere Entscheidungen. Diese Datei hält die vom Auftraggeber beschriebenen Anforderungen fest und trennt sie von Vorschlägen, Annahmen und offenen Fragen.
>
> **Stand:** 09.11.2026  
> **Status:** Frühe Konzeptions- und Anforderungsphase; Datenquellen, Schnittstellen, Zuständigkeiten und technische Rahmenbedingungen sind noch nicht abschließend geklärt.  
> **Projektkontext:** Stadtverwaltung Ludwigshafen am Rhein.

## 1. Projektvision

Für die Stadtverwaltung Ludwigshafen soll eine **zentrale, professionell strukturierte Dashboard-Plattform** entstehen. Sie soll Informationen aus vielen unterschiedlichen Quellen – Fachanwendungen, weiteren Programmen, Webseiten, Schnittstellen und gegebenenfalls lokal bzw. zentral abgelegten Excel-Dateien – möglichst aktuell in einer einheitlichen Benutzeroberfläche bereitstellen.

Neben einzelnen fachspezifischen Ansichten soll es **eine abteilungsübergreifende Gesamtübersicht**, **eine interaktive Stadtkarte** und **eine großformatige Besprechungsraum-Ansicht** geben. Die Anwendung soll modular, wartbar, erweiterbar und möglichst einfach reproduzierbar bereitzustellen sein, voraussichtlich mithilfe von Docker.

**Zentrales Ziel:** Nicht nur bestehende Bildschirme nebeneinander anzeigen, sondern Daten fachlich sinnvoll vereinheitlichen, verknüpfen, zusammenführen und daraus einen gemeinsamen, nachvollziehbaren Lage- und Informationsstand erzeugen.

## 2. Bereits benannte Anforderungen (vom Auftraggeber)

1. **Mehrere heterogene Datenquellen:** Daten stammen aus verschiedenen Programmen, Webseiten und möglicherweise Dateien; die technischen Zugriffswege sind noch unbekannt.
2. **Aktualitätsorientierte Darstellung:** Das Dashboard soll eine möglichst „live“ wirkende Gesamtübersicht bereitstellen. Ob tatsächlich Echtzeit möglich ist, hängt von jeder Quelle ab.
3. **Zusammenführung über Quellgrenzen:** Wenn Quelle A und Quelle B Daten zum selben Sachverhalt oder Objekt `X` enthalten, sollen diese nicht lediglich doppelt erscheinen, sondern sinnvoll zu einer gemeinsamen Ansicht zusammengeführt werden.
4. **Fach- und Einzelansichten:** Für jede Datenquelle bzw. jedes Fachgebiet sollen detaillierte Einzelansichten möglich sein; zusätzlich sollen Abteilungen passende eigene Dashboards erhalten.
5. **Interaktive Stadtkarte:** Für georeferenzierte Daten soll eine Karte des Stadtgebiets vorhanden sein. Beispiel: Eine Ampel an einem bestimmten Standort ist als Kartenobjekt sichtbar; beim Anklicken werden alle verfügbaren Informationen zu dieser Ampel angezeigt.
6. **Gesamtübersicht:** Ein übergreifendes Dashboard zeigt eine geeignete Auswahl wichtiger Daten aus verschiedenen Abteilungen auf einer Oberfläche.
7. **Großbildschirm / Besprechungsraum:** Die Gesamtübersicht soll auf einem sehr großen Bildschirm übersichtlich und aus größerem Abstand lesbar sein.
8. **Professionelle technische Struktur:** Klare Modulgrenzen, gute Wartbarkeit und Erweiterbarkeit sind wichtig.
9. **Einfache Bereitstellung:** Containerisierung, voraussichtlich Docker, soll die Installation, Updates und den Betrieb erleichtern.
10. **Unsichere Eingangsdaten:** Viele Datenanbindungen sind noch ungeklärt. Manche Informationen liegen möglicherweise ausschließlich als verstreute Excel-Dateien vor.

## 3. Wichtige Begriffsabgrenzung: „Live“ und „Daten zusammenführen“

### 3.1 Aktualität

„Live“ ist **ein Ziel, keine derzeit zugesicherte Eigenschaft aller Quellen**. Je nach Quelle kommen verschiedene Betriebsarten infrage:

- **Echtzeit/ereignisbasiert:** z. B. Push, Webhooks oder Message-Broker, sofern verfügbar.
- **Regelmäßig aktualisiert:** z. B. API-Abrufe alle paar Minuten.
- **Dateibasiert:** Import bei neuer Datei oder nach einem festgelegten Intervall.
- **Manuell gepflegt:** Dateien oder Meldungen werden nach festgelegtem Prozess bereitgestellt.

**Jedes Datenfeld bzw. Widget sollte nach Möglichkeit „Stand der Quelldaten“, „letzte erfolgreiche Synchronisierung“ und einen Aktualitäts-/Fehlerstatus anzeigen.** Ein aktueller Dashboard-Refresh darf nicht mit aktuellen Quelldaten verwechselt werden.

### 3.2 Zusammenführung gleicher Sachverhalte

Die Plattform soll gemeinsame Objekte und Sachverhalte erkennen und nach definierten Regeln zusammenführen. Beispiel: Ein Ampelobjekt besitzt in einer Quelle Stammdaten (Standort, Anlagenkennung) und in einer anderen Quelle Betriebs- oder Störungsinformationen. In der gemeinsamen Ansicht erscheinen beide Informationsbereiche unter **einem** Ampelobjekt, inklusive nachvollziehbarer Quellenangaben.

Dafür werden benötigt:

- ein **kanonisches Datenmodell** für zentrale Objekttypen, z. B. Ampeln, Straßenabschnitte, Maßnahmen, Meldungen oder Kennzahlen;
- stabile **Objekt-IDs** und Zuordnungsregeln zwischen den Quellsystemen;
- Regeln zur **Dublettenprüfung**, Konfliktbehandlung, Priorisierung und Datenqualität;
- **Provenienz**: Es muss nachvollziehbar bleiben, welches Feld aus welcher Quelle stammt;
- getrennte Speicherung von **Rohdaten**, normalisierten Daten und zusammengeführten Ansichten, soweit sinnvoll;
- Prüfung mehrdeutiger Zuordnungen statt ungeprüfter automatischer Verschmelzung.

**Nicht jedes gleich benannte Feld ist automatisch fachlich identisch.** Bedeutung, Maßeinheit, Zeitbezug und Zuständigkeit müssen berücksichtigt werden.

## 4. Geplante Hauptansichten

### 4.1 Gesamtübersicht (Management-/Lagebild)

- Übersicht wichtiger abteilungsübergreifender Kennzahlen, Trends, Statusmeldungen und Auffälligkeiten.
- Auswahl nach Relevanz, Aktualität und Aussagekraft; kein unstrukturierter „Datenfriedhof“.
- Einheitliche Filter, z. B. Zeitraum, Fachbereich und geografischer Ausschnitt, sofern fachlich sinnvoll.
- Möglichkeit, von aggregierten Werten in Detailansichten zu wechseln (Drill-down).
- Transparente Anzeige von Datenstand, Quelle und Ausfällen.

### 4.2 Fachbereichs- und Quellansichten

- Eigene Seiten für Abteilungen, Themen und bei Bedarf einzelne Quellsysteme.
- Detailtabellen, Such- und Filtermöglichkeiten, Diagramme und objektspezifische Informationen.
- Rollenspezifische Sichtbarkeit und fachlich definierte Kennzahlen.
- Fachbereichsübergreifend wiederverwendbare UI-Komponenten.

### 4.3 Interaktive Stadtkarte Ludwigshafen

- Stadtkarte mit georeferenzierten Objekten und Ebenen (Layern).
- Beispiel-Layer: Lichtsignalanlagen/Ampeln; weitere Layer erst nach Bestätigung der Datenlage.
- Klick auf ein Kartenobjekt öffnet ein Detailpanel mit ID, Standort, Zustand, relevanten Kennzahlen, Quellen und Aktualisierungszeit.
- Suche, Filter, Legende und ein-/ausblendbare Ebenen.
- Bei großen Datenmengen: Clustering, performante Layer und räumliche Abfragen.
- Einheitliches Koordinatensystem bzw. geprüfte Transformation unterschiedlicher Quellkoordinaten.
- Geeignete Karten- und Geodatenlizenzen sowie Betriebsmöglichkeiten klären.

**Beispiel (illustrativ, keine Aussage über reale Datenbestände):**

`Ampel-ID 4711` → Standort auf der Karte → Stammdaten aus Fachverfahren A + Störungsstatus aus Quelle B + Wartungsinformationen aus Excel-Datei C. Die Verknüpfung erfolgt anhand gesicherter IDs bzw. verifizierter Zuordnung.

### 4.4 Großbildschirm-Modus für Besprechungsraum

- Separate **TV-/Wallboard-Ansicht** der abteilungsübergreifenden Gesamtübersicht.
- Für 16:9 und hochauflösende Displays optimiert, responsiv und aus Distanz lesbar.
- Große Schrift, klare Informationshierarchie, begrenzte Kennzahlenzahl, eindeutige Statusindikatoren.
- Automatische Datenaktualisierung; optional kontrollierter Wechsel zwischen mehreren Ansichten, falls gewünscht.
- Möglichst ohne erforderliche Maus-/Tastaturinteraktion.
- Deutlich sichtbarer Stand der letzten Datenaktualisierung und Hinweis bei fehlenden Daten.
- Datenschutz: Auf einem gemeinsam sichtbaren Besprechungsraum-Bildschirm **nur dafür freigegebene Daten** zeigen.

## 5. Vorläufiger Architekturvorschlag (noch keine beschlossene Technologieentscheidung)

```text
Fachprogramme / APIs / Webseiten / Excel-Dateien / ggf. Geodienste
                            │
                            ▼
             Quelladapter / Import-Pipelines
        (API, Datei, Export, Ereignisse, ggf. Scraping*)
                            │
                            ▼
            Validierung + Transformation + Zuordnung
           (kanonisches Modell, ID-Mapping, Historie)
                            │
                            ▼
          Zentrale Datenhaltung + Metadaten/Status
              (z. B. PostgreSQL + PostGIS)
                            │
                            ▼
             Backend-API / Aggregationen / Rechte
                            │
                            ▼
      Web-Frontend: Gesamtübersicht | Fachbereiche
                  Stadtkarte | Wallboard
```

`*` Web-Scraping nur, wenn rechtlich/technisch zulässig und stabil genug; APIs, bereitgestellte Exporte und offizielle Schnittstellen bevorzugen.

**Architekturprinzipien:**

- **Adapter je Quelle:** Änderungen an einem Fachsystem sollen möglichst nur dessen Adapter betreffen.
- **Entkopplung:** Die Benutzeroberfläche liest möglichst nicht direkt aus unkontrollierten Quellsystemen, sondern über eine zentrale Backend-Schicht.
- **Rohdaten und Normalisierung trennen:** Für Fehleranalyse, Datenherkunft und spätere Anpassungen.
- **Wiederverwendbare Komponenten:** Gemeinsame Karten-, Tabellen-, KPI- und Filterbausteine.
- **Konfiguration statt Hardcoding:** Quellverbindungen, Aktualisierungsintervalle und Freigaben wo sinnvoll konfigurierbar.
- **Schrittweise Erweiterbarkeit:** Neue Quellen ohne grundlegenden Umbau anschließen.
- **Fehlerisolierung:** Der Ausfall einer Quelle darf nicht das ganze Dashboard lahmlegen.
- **Beobachtbarkeit:** Logs, Importstatus, Fehlerberichte, Metriken und Warnungen.

### 5.1 Mögliche Technologiebausteine (zur Evaluierung)

| Schicht | Vorläufige Option | Begründung / offener Punkt |
|---|---|---|
| Frontend | React + TypeScript, z. B. mit Vite oder Next.js | Komponentenbasierte, interaktive Dashboards; konkrete Wahl offen |
| Kartenoberfläche | MapLibre GL JS oder Leaflet | Interaktive Layer, Marker, Pop-ups/Detailansichten; Lizenz und Kartenbasis prüfen |
| Backend | Python/FastAPI oder Node.js/NestJS | Schnittstellen, Zusammenführung und Zugriffskontrolle; Teamkenntnisse entscheidend |
| Datenbank | PostgreSQL + PostGIS | Strukturierte Daten und Geodaten/Raumabfragen |
| Hintergrundjobs | Scheduler + Worker/Job-Queue nach Bedarf | Wiederkehrende Imports und Verarbeitung außerhalb von HTTP-Anfragen |
| Dateiverarbeitung | Geeignete Excel-/CSV-Parser, Importvalidierung | Heterogene Excel-Formate, definierte Vorlagen und Fehlerreports |
| Deployment | Docker Compose zunächst; später ggf. Orchestrierung | Reproduzierbarer Betrieb; Infrastruktur- und IT-Vorgaben klären |
| Authentifizierung | Anbindung an vorhandenes SSO/AD/LDAP/OIDC, falls vorhanden | Keine eigene Benutzerverwaltung ohne Prüfung vorhandener Lösungen |

**Wichtig:** Das ist kein verbindlicher Stack. Die konkrete Auswahl muss sich an IT-Standards, Hosting, Netzwerk, Lizenzvorgaben, Sicherheitsrichtlinien und vorhandenen Kompetenzen der Stadtverwaltung orientieren.

## 6. Strategie für unbekannte Quellsysteme

Vor der Umsetzung einer Verbindung braucht jede Quelle einen **Steckbrief**:

| Eigenschaft | Zu ermitteln |
|---|---|
| Quelle | Name, Fachbereich, technischer und fachlicher Ansprechpartner |
| Inhalt | Fachliche Objekte, Felder, Kennzahlen, Datenvolumen |
| Zugriff | REST/GraphQL, Datenbank, Export, Excel/CSV, Weboberfläche, sonstiges |
| Berechtigung | Wer darf zugreifen; technische Accounts; Datenschutz/Freigaben |
| Aktualität | Änderungsfrequenz, gewünschter und realistisch möglicher Aktualisierungstakt |
| Identifikation | Stabile Schlüssel, IDs, Geokoordinaten, Zeitstempel |
| Qualität | Fehlende Werte, Dubletten, inkonsistente Begriffe, Formatprobleme |
| Verknüpfbarkeit | Gemeinsame Schlüssel mit anderen Quellen, fachliche Mappingregeln |
| Betrieb | Verfügbarkeit, Ausfallverhalten, Ansprechpartner, Änderungshistorie |
| Priorität | Nutzen, Realisierungsaufwand, Risiken, MVP-Eignung |

**Excel-Dateien sind als erste Datenquelle ausdrücklich vorgesehen**, auch wenn sie nicht automatisch in Echtzeit aktualisierbar sind. Falls kein stabiler technischer Zugriff möglich ist, soll zunächst ein robuster Importprozess mit definierter Dateiablage/Upload, Formatprüfung, Protokollierung und Quarantäne fehlerhafter Datensätze vorgesehen werden. Später kann derselbe Adapter ggf. durch eine API-Anbindung ersetzt werden.

## 7. Daten- und Sicherheitskonzept

Da es sich um eine kommunale Verwaltung handelt, müssen die konkreten Vorgaben durch die zuständigen Stellen geklärt werden. Bereits im Entwurf berücksichtigen:

- **Rollen- und Rechtekonzept:** Anzeige pro Abteilung, Rolle, Datenkategorie und gegebenenfalls Objekt.
- **Datenschutz:** Datenminimierung, ggf. DSGVO-konforme Verarbeitung, Rechtsgrundlage, Lösch- und Aufbewahrungsfristen; Prüfung durch die zuständigen Stellen.
- **Informationssicherheit:** Verschlüsselung bei Übertragung, sichere Speicherung von Zugangsdaten, Netzwerksegmentierung, Berechtigungsmindestmaß, Updates und Absicherung der APIs.
- **Nachvollziehbarkeit:** Datenherkunft, Transformationsregeln, Importläufe und relevante Änderungen protokollieren.
- **Datenqualität:** Validierungsregeln, Definition führender Quellen, Umgang mit Widersprüchen und veralteten Daten.
- **Betrieb:** Monitoring, Backups, Restore-Tests, Wiederanlauf, Wartung und definierte Verantwortlichkeiten.
- **Wallboard-Freigabe:** Sichtbarkeit auf dem großen Bildschirm ist ausdrücklich gesondert zu bewerten.
- **Keine unkontrollierte Datenübermittlung an Dritte:** Kartenanbieter, Telemetrie, Cloud-Dienste und externe Bibliotheken vor Einsatz prüfen.

## 8. Deployment und Projektstruktur

**Ziel:** Nachvollziehbarer und möglichst einfacher Aufbau einer Umgebung, etwa über versionierte Konfiguration und Docker-Images. Eine erste Docker-Compose-Bereitstellung könnte Frontend, Backend, Datenbank und Worker umfassen. Für Produktion müssen Betriebskonzept, Backup, Reverse-Proxy/TLS, Secrets, Netzwerkvorgaben, Monitoring und Updateverfahren ergänzt werden.

Illustrative Repository-Struktur:

```text
stadt-dashboard/
├── README.md
├── docs/
│   ├── projektkontext.md
│   ├── architektur.md
│   ├── datenquellen-katalog.md
│   ├── datenmodell.md
│   ├── sicherheit-und-betrieb.md
│   └── entscheidungsprotokoll.md
├── frontend/
├── backend/
├── integrations/
│   ├── source-a/
│   ├── source-b/
│   └── excel-import/
├── jobs/
├── infrastructure/
│   ├── docker/
│   └── compose.yaml
├── tests/
└── .env.example
```

Die Struktur ist ein Vorschlag und darf bei einem Monorepo, mehreren Services oder abweichenden Teamkonventionen angepasst werden. **Keine echten Passwörter oder Zugangstoken ins Repository aufnehmen.**

## 9. Empfohlene Umsetzung in Phasen

**Phase 0 – Bestandsaufnahme und fachliche Abstimmung**

- Stakeholder, Fachbereiche, Nutzungsszenarien und Verantwortlichkeiten klären.
- Quelleninventar anlegen, Datenzugriff und Datenschutz-/IT-Freigaben prüfen.
- Relevante Kennzahlen, Datenobjekte und Prioritäten für die Gesamtübersicht bestimmen.
- Definition von „live“ und gewünschte Aktualisierungsintervalle pro Quelle abstimmen.

**Phase 1 – Technischer Proof of Concept**

- Eine gut zugängliche Quelle und eine Excel-Quelle exemplarisch anbinden.
- Datenimport, Normalisierung, Datenstand und Fehlerbehandlung demonstrieren.
- Eine einfache Karte mit Beispieldaten und ein anklickbares Objekt umsetzen.
- Eine erste grobe Gesamtübersicht für den Großbildschirm entwerfen.

**Phase 2 – MVP (Minimum Viable Product)**

- Kernarchitektur, Anmeldung/Rollen, Datenbank, Basis-Monitoring und Docker-Deployment.
- Wenige priorisierte Quellen inklusive mindestens eines nachgewiesenen Datenzusammenführungsfalls.
- Gesamtübersicht, fachliche Detailansichten, Karte und Wallboard-Modus.
- Tests für Datenqualität, Importfehler und Berechtigungen.

**Phase 3 – Erweiterung und Produktivbetrieb**

- Weitere Adapter und Fachbereiche integrieren.
- Historisierung, komplexere Auswertungen, bessere Datenverknüpfung und Benachrichtigungen nach Bedarf.
- Betriebsdokumentation, Backup-/Restore-Tests, Performance- und Sicherheitsprüfungen.
- Rollout, Schulung und laufendes Änderungsmanagement.

## 10. Offene Fragen (nicht als beantwortet behandeln)

1. Welche Fachbereiche sind am Anfang beteiligt und welche Daten sollen zuerst sichtbar werden?
2. Welche Programme, Webseiten, Datenbanken, Exportmechanismen und Excel-Ablagen gibt es konkret?
3. Welche Daten dürfen zwischen Abteilungen zusammengeführt bzw. gemeinsam angezeigt werden?
4. Gibt es bereits ein städtisches GIS, Geodatenserver, amtliche Kartenbasis oder definierte Objektkennungen?
5. Welche Quellen liefern wirklich Echtzeitinformationen, welche nur Tages-/Wochenstände?
6. Welche gemeinsamen fachlichen Schlüssel existieren zur zuverlässigen Verknüpfung?
7. Wer definiert und bestätigt Kennzahlen, Ampelstatus, Datenqualitätsregeln und Quellprioritäten?
8. Wo soll die Plattform laufen: städtisches Rechenzentrum, vorhandene Server, private Cloud oder anderswo?
9. Welche IT-Standards, Netzvorgaben, Firewall-Regeln, Authentifizierungs- und Sicherheitsanforderungen gelten?
10. Welche Auflösung, Größe, Entfernung und Interaktionsmöglichkeiten hat der Besprechungsraum-Bildschirm?
11. Wer administriert Datenquellen, Berechtigungen und Betriebsstörungen nach der Einführung?
12. Gibt es Zeitplan, Budget, Teamgröße, vorhandene Technologien und verbindliche Meilensteine?

## 11. Leitlinien für zukünftige Arbeit mit diesem Projektkontext

Bei späteren Architektur-, Code-, Design- und Planungsaufgaben gilt:

- **Gesicherte Anforderungen, technische Vorschläge und ungeklärte Punkte immer unterscheiden.**
- **Keine existierenden APIs, Datenbanken, Excel-Schemata, Kartenobjekte, Server oder städtischen Freigaben erfinden.**
- Neue Datenquellen möglichst über eigenständige Adapter anbinden.
- Daten dürfen nur nach definierten fachlichen Regeln zusammengeführt werden; Quelle und Aktualität sichtbar halten.
- Die **interaktive Stadtkarte**, **Fachbereichsansichten**, **Gesamtübersicht** und **Wallboard für große Displays** sind gleichberechtigte Kernbestandteile.
- Bei Anzeige im Besprechungsraum Lesbarkeit und Datenschutz mitdenken.
- Für Architekturentscheidungen zunächst wartbare, nachvollziehbare und einfach deploybare Lösungen bevorzugen.
- Excel-Importe als vollwertigen Übergangsweg berücksichtigen, statt überall APIs vorauszusetzen.
- Sicherheits-, Datenschutz- und Betriebsfragen früh einbeziehen, ohne ungeprüfte rechtliche oder organisatorische Annahmen zu treffen.
- Diese Datei bei neuen bestätigten Erkenntnissen aktualisieren; technische Entscheidungen möglichst in einem eigenen Entscheidungsprotokoll festhalten.

---

**Kurzbeschreibung für neue Chats:** Es geht um eine modular aufgebaute, per Docker deploybare Dashboard-Plattform für die Stadtverwaltung Ludwigshafen, die heterogene Daten aus Fachsoftware, Webseiten, APIs und Excel-Dateien integriert, fachlich gleiche Objekte quellenübergreifend konsolidiert, Fachbereichsansichten sowie eine interaktive Stadtkarte bereitstellt und ein gut lesbares abteilungsübergreifendes Wallboard für einen großen Besprechungsraum-Bildschirm bietet. Datenquellen, Schnittstellen, Updatehäufigkeiten und Infrastruktur sind zum Projektstart weitgehend unbekannt und müssen schrittweise inventarisiert und validiert werden.
