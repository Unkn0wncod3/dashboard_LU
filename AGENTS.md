# AGENTS.md — Stadtverwaltung Ludwigshafen | Zentrale Dashboard-Plattform

> **Geltungsbereich:** Verbindliche Arbeitsanweisungen für KI-Coding-Agents und automatisierte Entwicklungswerkzeuge in diesem Repository. Lies diese Datei **vor jeder Analyse oder Änderung**. Sie ersetzt weder verbindliche Vorgaben der Stadtverwaltung noch fachliche, datenschutzrechtliche oder IT-Sicherheitsfreigaben.
>
> **Projektstatus:** Frühe Konzeptions- und Anforderungsphase (Stand 09.11.2026). Technologien, Datenquellen, Schnittstellen, Infrastruktur und Freigaben sind in weiten Teilen noch offen.
>
> **Referenz:** `Projektkontext_Stadtverwaltung_Ludwigshafen_Dashboard.md` bzw. die im Repository dokumentierte Projektkontext-Datei. Im Konfliktfall gelten bestätigte Anforderungen und verbindliche städtische Vorgaben vor unverbindlichen Architekturideen.

## 1. Projektauftrag und Nutzen

Dies ist ein **offizielles Projekt für die Stadtverwaltung Ludwigshafen am Rhein**. Ziel ist eine sichere, leistungsfähige, wartbare und zentral betreibbare Webplattform, die Informationen aus heterogenen Fachverfahren, Programmen, Webseiten, APIs und Excel-/CSV-Dateien **fachlich sinnvoll integriert**.

Der Nutzen besteht nicht darin, verschiedene Oberflächen lediglich nebeneinander darzustellen. Die Plattform soll Daten zu demselben realen Objekt oder Sachverhalt nach nachvollziehbaren Regeln konsolidieren, Doppelanzeigen vermeiden und ein gemeinsames, abteilungsübergreifendes Lagebild schaffen. Dafür müssen Datenherkunft, Aktualität, Konflikte und Zugriffsberechtigungen erkennbar bleiben.

**Vier gleichberechtigte Kernansichten:**

1. **Gesamtübersicht:** Abteilungsübergreifende Kennzahlen, Zustände, Trends und relevante Ereignisse, mit Drill-down.
2. **Fachbereichs- und Quellansichten:** Geeignete Detailansichten, Filter, Tabellen, Diagramme und berechtigungsgesteuerte Fachinformationen.
3. **Interaktive Stadtkarte:** Georeferenzierte Daten als Layer und anklickbare Objekte mit Detailpanel. Beispiel: Eine Lichtsignalanlage/Ampel an einem Standort, deren Stammdaten, Betriebsstatus und Wartungsinformationen aus mehreren Quellen stammen können. Dieses Beispiel ist **kein Beleg**, dass entsprechende Daten bereits vorliegen.
4. **Wallboard/Besprechungsraum:** Auf große 16:9-Bildschirme ausgelegte, aus Entfernung lesbare und datenschutzgerecht freigegebene Gesamtansicht mit sichtbarer Datenaktualität.

**„Live“ ist eine Zielvorstellung, keine zugesicherte Echtzeitfähigkeit.** Jede Quelle kann einen anderen Aktualisierungstakt haben. Zeige nach Möglichkeit Quellzeitpunkt, letzte erfolgreiche Synchronisation und Fehler-/Veraltungsstatus; niemals eine bloß neu gerenderte Ansicht als neue Quelldaten ausgeben.

## 2. Unverhandelbare Agentenregeln

### 2.1 Keine eigenmächtigen Git-, Release- oder Produktionsaktionen

- **Niemals selbstständig `git commit`, `git push`, `git merge`, `git rebase`, Tagging, Releases oder Pull-Request-Merges ausführen.** Auch nicht als vermeintliche Aufräummaßnahme oder nach erfolgreichem Test.
- **Keine Branches, Commits, Tags, Remote- oder Repository-Einstellungen ohne ausdrücklichen Auftrag verändern.** Keine History-Rewrites, `git reset --hard`, `git clean -fd`, Force-Pushes oder vergleichbar destruktive Aktionen.
- Erlaubt sind im Rahmen des Arbeitsauftrags **lokale Dateiänderungen, lesende Git-Kommandos** (`git status`, `git diff`) und lokale, sichere Tests.
- **Deployment, produktive Datenbankmigrationen, externe Datenimporte, Netzwerkfreigaben und Änderungen an produktiven Diensten ausschließlich nach gesonderter ausdrücklicher Autorisierung.** Eine Erlaubnis zum Code-Schreiben ist keine Betriebserlaubnis.
- Vor jeder Weitergabe Änderungen und Tests kurz dokumentieren; die verantwortliche Person entscheidet über Commit, Review, Merge und Deployment.

### 2.2 Sicherheit und Datenschutz vor Bequemlichkeit

- Behandle Quellinformationen und Verwaltungsdaten standardmäßig als **schutzbedürftig, bis ihre Einstufung geklärt ist**. Daten nicht in öffentliche Dienste, fremde APIs, Telemetrie, Cloud-KI oder externe Kartenanbieter übertragen, wenn dies nicht geprüft und freigegeben wurde.
- **Keine Secrets** (Passwörter, Tokens, Zertifikatsprivatekeys, Verbindungszeichenfolgen), personenbezogene Echtdaten oder verwaltungsinterne Exporte in Quellcode, Logs, Beispieldaten, Testfixtures, Screenshots, Commits oder Tickets aufnehmen. Konfiguration über Umgebungsvariablen bzw. freigegebene Secret-Verwaltung; nur Platzhalter in `.env.example`.
- Eingaben, API-Antworten, Uploads und Excel-Dateien sind **nicht vertrauenswürdig**. Serverseitig validieren: Typen, Größen, Formate, Pfade, Zugriff, Feldwerte und zulässige Operationen. Fehlerhafte Daten isolieren, nachvollziehbar melden und keine stillschweigende Datenkorrektur vornehmen.
- Verhindere insbesondere SQL-/Command-Injection, XSS, CSRF (wo einschlägig), SSRF, Path Traversal, unsichere Deserialisierung, IDOR und unkontrollierte Dateiuploads. Verwende parametrisierte Queries, sichere Ausgabe-/HTML-Behandlung, kontrollierte ausgehende Verbindungen und restriktive CORS-Einstellungen.
- **Authentifizierung und Autorisierung serverseitig durchsetzen**, nach dem Least-Privilege-Prinzip. Frontend-Ausblendung allein ist keine Zugriffskontrolle. Rollen, Abteilungen und Datenfreigaben nicht erfinden.
- Datenübertragung verschlüsseln (TLS in freigegebener Betriebsumgebung), Schutz von gespeicherten Daten, sichere Header, Session-/Token-Verwaltung, angemessene Rate-Limits und nachvollziehbare sicherheitsrelevante Ereignisse vorsehen.
- Sensible Daten nicht unkontrolliert loggen; strukturierte Logs mit geeigneter Maskierung verwenden. Datenschutz, Rechtsgrundlagen, Speicherfristen, Schutzbedarfe, interne Sicherheitsvorgaben und ggf. DSGVO-Prüfungen bleiben durch zuständige Stellen zu bestätigen.
- Besonders die **Wallboard-Ansicht** darf nur explizit für den gemeinschaftlich sichtbaren Raum freigegebene Informationen zeigen. Kein automatisches Durchreichen fachbereichsinterner Detaildaten.
- Kein unkontrolliertes Web-Scraping. Offizielle Schnittstellen und genehmigte Exportwege bevorzugen; Bedingungen, Berechtigungen und Belastung der Quellsysteme beachten.

### 2.3 Effizienz, Stabilität und Wartbarkeit

- Schreibe **klaren, einfachen, typisierten, modularen und messbar effizienten Code**. Verständlichkeit und Korrektheit haben Vorrang vor unbelegter Mikrooptimierung.
- Verwende asynchrone bzw. Hintergrundverarbeitung für Imports und teure Aggregationen. Lange Datenabrufe nicht an UI-Requests koppeln; Timeouts, Retry mit Backoff/Jitter, Begrenzungen und Fehlerisolierung einsetzen.
- Verhindere N+1-Abfragen, unnötige Volltabellenscans, unlimitierte Datentransfers, große Payloads und überflüssige Polling-Last. Nutze Pagination, geeignete Indizes, Caching/inkrementelle Aktualisierung und serverseitige Aggregation dort, wo sie nachweislich sinnvoll sind.
- Für die Karte: räumliche Indizes/Abfragen, Bounding-Box-Filter, Clustering und performante Layer bei Bedarf. Keine ungefilterte Übertragung aller Stadtobjekte bei jedem Kartenwechsel.
- Für das Wallboard: stabile Darstellung, sinnvolle Refresh-Intervalle, klare Zustände bei Quellausfall und keine unnötigen Komplett-Reloads.
- Externe Ausfälle dürfen **nicht das gesamte Dashboard blockieren**. Zeige einen letzten gültigen Stand nur dann, wenn er entsprechend als möglicherweise veraltet gekennzeichnet ist.
- Vor Performancetuning relevante Metriken und typische Datenvolumina ermitteln; keine unbelegten Aussagen über „Echtzeit“, Skalierbarkeit oder Performance machen.

## 3. Architekturgrundsätze

Das folgende Architekturmodell ist **eine Empfehlung, keine bereits beschlossene Technologieentscheidung**:

```text
Fachverfahren / APIs / Webseiten / Excel- und CSV-Dateien / Geodienste
                ↓
       Quellspezifische Adapter
                ↓
   Validierung → Normalisierung → Identitätszuordnung
                ↓
  Zentrale Datenhaltung + Provenienz + Aktualitätsstatus
                ↓
 Backend-API / Aggregationen / Berechtigungsprüfung
                ↓
 Gesamtübersicht | Fachbereich | Karte | Wallboard
```

- **Integrationen entkoppeln:** Für jede externe Datenquelle einen eigenen Adapter mit klar definiertem Vertrag, Fehlermeldungen, Tests und dokumentierter Aktualisierungsstrategie vorsehen.
- **Gemeinsames Datenmodell:** Quellübergreifende Objekte über verifizierte IDs bzw. fachlich bestätigte Matching-Regeln verbinden. Gleiche Feldnamen sind nicht automatisch gleiche Bedeutungen.
- **Datenherkunft erhalten:** Roh-/normalisierte/zusammengeführte Informationen konzeptionell trennen; Feldherkunft, Quellzeitstempel und Transformationsregeln nachvollziehbar speichern, soweit erforderlich und zulässig.
- **Konflikte sichtbar machen:** Widersprüche zwischen Quellen nach expliziten, bestätigten Prioritätsregeln auflösen oder markieren; bei unklarer Identität keine automatische Objektverschmelzung.
- **Excel als vollwertiger Eingang:** Auch ohne API einen robusten, überprüfbaren Import ermöglichen. Variierende Spalten, Formate, Einheiten, Zeichensätze, Datumswerte, Dubletten und fehlerhafte Dateien berücksichtigen. Hochgeladene Daten nie ohne Validierung als vertrauenswürdig betrachten.
- **Technologie offen halten:** React/TypeScript, FastAPI oder NestJS, PostgreSQL/PostGIS, MapLibre oder Leaflet sowie Docker Compose sind mögliche Optionen, keine bereits genehmigten Festlegungen. Vor Auswahl städtische IT-Standards, Betrieb, Lizenzen, Netzwerk und Teamkompetenzen prüfen.
- **Reproduzierbares Deployment anstreben:** Docker mit schlanken, möglichst unveränderlichen Images, gepinnten Versionen, Non-Root-Laufzeit, Healthchecks, Ressourcenlimits, getrennten Konfigurationen, Secret-Management und dokumentierter Backup-/Restore-Strategie. Keine öffentlich erreichbaren Dienste oder ungeschützten Datenbankports als Standard.

## 4. Vorgehen bei jeder Entwicklungsaufgabe

1. **Kontext lesen:** Diese `AGENTS.md`, Projektkontext, vorhandene README/Architektur-/Sicherheitsdokumentation und die relevanten Codestellen. Bestehende Konventionen respektieren.
2. **Auftrag abgrenzen:** Explizite Anforderung, bekannte Annahmen, offene Abhängigkeiten, berührte Daten und Sicherheitsauswirkungen unterscheiden. Bei wesentlichen fachlichen Unklarheiten gezielt nachfragen; ansonsten sichere, reversible Defaults wählen und dokumentieren.
3. **Minimal und modular umsetzen:** Kleine, prüfbare Änderungen statt unnötiger Komplettumbauten. Nicht benötigte Dependencies, zusätzliche Services und Infrastruktur vermeiden.
4. **Verifizieren:** Relevante Tests, Linting, Typprüfung und Sicherheitsprüfungen ausführen, soweit lokal möglich. Bei Datenintegration auch Fehlerfälle, Dubletten, Konflikte und verspätete Quellen testen. Bei Berechtigungen negative Zugriffstests vorsehen. Bei kritischen Datenflüssen und teuren Abfragen Performance kontrollieren.
5. **Ergebnis dokumentieren:** Geänderte Dateien, fachliche Annahmen, Sicherheitsaspekte, Tests und verbleibende Risiken knapp berichten. Ergebnisse nie als geprüft ausgeben, wenn die Prüfung nicht stattgefunden hat.
6. **Übergabe ohne Commit:** Lokale Änderungen für Review belassen. `git status`/`git diff` zur Kontrolle verwenden; **keine Commits, Pushes, Merges oder Deployments** ausführen.

## 5. Qualitätsanforderungen und Tests

- **Korrektheit:** Datenverarbeitung ist deterministisch, soweit fachlich möglich; Einheiten, Zeiträume, Zeitzonen, geografische Koordinaten und Schlüssel werden explizit behandelt.
- **Tests:** Unit-Tests für Mapping/Validierung/Aggregation, Integrationstests für Adapter und API, rollenbasierte Zugriffstests, Importtests mit synthetischen Excel-Dateien und UI-Tests für zentrale Ansichten.
- **Fehlerszenarien:** Nicht erreichbare Quelle, fehlerhaftes Schema, doppelte Objekte, abgelaufene Zugangsdaten, langsame Abfragen, fehlende Geokoordinaten und veraltete Werte berücksichtigen.
- **Accessibility & Nutzung:** Lesbare Kontraste, Tastaturbedienbarkeit, sinnvolle Statusindikatoren, verständliche Fehlermeldungen; Distanzlesbarkeit des Wallboards separat prüfen.
- **Dependencies:** Nur notwendige, gepflegte und lizenzrechtlich zulässige Pakete einsetzen; bekannte Schwachstellen prüfen. Lockfiles beibehalten und Versionen reproduzierbar verwalten.
- **Betrieb:** Health-/Readiness-Prüfungen, Monitoring, kontrollierte Migrationen, Wiederanlauf und definierte Fehler-/Alarmwege vorsehen, bevor produktiv gegangen wird.

## 6. Was ausdrücklich nicht angenommen werden darf

- Es gibt **noch keine bestätigte Liste** tatsächlich anschließbarer Fachverfahren, APIs, Excel-Ablagen, Datenfelder oder Live-Datenströme.
- Es gibt **noch keine bestätigte Produktivumgebung**, genehmigte Karteninfrastruktur, finalen Tech-Stack oder SSO-Anbindung.
- Es ist **nicht geklärt**, welche Daten zwischen Fachbereichen geteilt werden dürfen oder auf dem Besprechungsraum-Bildschirm sichtbar sein dürfen.
- Beispielobjekte, beispielsweise eine Ampel, sind **illustrativ** und dürfen nicht als tatsächlicher Verwaltungsdatenbestand ausgegeben werden.
- Es ist **nicht gesichert**, dass Quellen über eindeutige Schlüssel verknüpfbar sind. Keine spekulative Zusammenführung als Tatsache präsentieren.
- „Live“ bedeutet **nicht**, dass jede Quelle in Echtzeit verfügbar ist.

Bei unbekannten Schnittstellen zuerst Quellensteckbrief, Datenklassifikation, verantwortliche Stelle, Zugriffsweg, Aktualitätsgrenze und Datenqualität klären. Für Prototypen ausschließlich klar gekennzeichnete synthetische Daten verwenden, sofern reale Testdaten nicht ausdrücklich freigegeben sind.

## 7. Prioritäten und Entscheidungsregel

Bei Zielkonflikten gilt grundsätzlich:

**Rechtmäßigkeit und behördliche Freigaben → Informationssicherheit und Datenschutz → fachliche Korrektheit und Datenqualität → Verfügbarkeit und Robustheit → Wartbarkeit → nachgewiesene Performance → Komfort und Optik.**

Leistungsanforderungen sind ernst zu nehmen, dürfen aber keine unsichere Datenverarbeitung rechtfertigen. Benenne Trade-offs und offene Entscheidungen ausdrücklich. Architekturentscheidungen, Datenverknüpfungsregeln und Betriebsannahmen dokumentieren, statt sie stillschweigend festzulegen.

---

**Kurzregel für jeden Agenten:** Arbeite an einer offiziellen städtischen Dashboard-Plattform. Baue sichere, effiziente, klar strukturierte und Docker-taugliche Komponenten für Datenintegration, Fachansichten, interaktive Stadtkarte und Besprechungsraum-Wallboard. Gehe bei Quellen und Freigaben von offenen Fragen aus. **Ändere Code nur im beauftragten Umfang; committe, pushe und deploye niemals eigenmächtig.**
