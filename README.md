# Mängelmelder-Auswertung Ludwigshafen

Dieses Repository enthält einen frühen Proof of Concept zur lokalen Auswertung
öffentlich abrufbarer Listenseiten des Ludwigshafener Mängelmelders. Die
gespeicherten HTML-Seiten werden offline analysiert und zu einer konsolidierten
JSON-Datei zusammengeführt.

Die Auswertung ist noch keine bestätigte oder produktiv freigegebene
Datenanbindung der Stadtverwaltung. Abrufhäufigkeit, Nutzungsbedingungen,
Datenklassifikation und spätere Betriebsfreigabe müssen vor einem Regelbetrieb
geklärt werden.

## Dateien

- `mängelmelder_test_crawl.py`: kontrollierter HTML-Abruf und Offline-Analyse
- `maengelmelder_daten/seite_*.html`: bereits gespeicherte Listenseiten
- `maengelmelder_daten/maengel.json`: zusammengeführtes Analyseergebnis
- `maengelmelder_daten/statistik_minimal.json`: datensparsame Kennzahlen
- `dashboard_server.py`: lokaler HTTP-Server und JSON-Endpunkte
- `web/index.html`: semantische Struktur des Dashboards
- `web/assets/styles.css`: Layout und responsive Darstellung
- `web/assets/app.js`: Datenabruf, Filter, Diagramme und Tabelle
- `test_maengelmelder.py`: Tests der Analyse mit synthetischen Daten
- `test_dashboard_server.py`: Tests für Website und JSON-Endpunkte
- `AGENTS.md`: verbindliche Sicherheits- und Projektregeln

## Vorhandene HTML-Seiten analysieren

Im Projektverzeichnis ausführen:

```powershell
python ".\mängelmelder_test_crawl.py" analyse
```

Standardmäßig liest der Befehl alle Dateien mit der Endung `.html` aus
`maengelmelder_daten` und schreibt das Ergebnis nach
`maengelmelder_daten/maengel.json`.

Andere Pfade können ausdrücklich angegeben werden:

```powershell
python ".\mängelmelder_test_crawl.py" analyse `
  --input ".\maengelmelder_daten" `
  --output ".\maengelmelder_daten\maengel.json" `
  --minimal-output ".\maengelmelder_daten\statistik_minimal.json"
```

Der Analysevorgang benötigt keine Netzwerkverbindung und keine zusätzlichen
Python-Pakete.

## Bestand mit einem Funktionsaufruf aktualisieren

Der öffentliche Einstiegspunkt für Abruf, Analyse, Zusammenführung und beide
JSON-Ausgaben ist `aktualisiere_maengelbestand(...)`. Die Funktion beginnt
immer bei Seite 1, lädt den vorhandenen Gesamtbestand nur einmal und verwaltet
bekannte Meldungs-IDs in einem Set. Neue Meldungen werden vor den bisherigen
Bestand gesetzt. Sobald eine Seite mindestens eine bereits bekannte ID enthält,
wird diese Seite noch vollständig ausgewertet und der Abruf danach beendet.
Damit benötigt ein normaler Refresh in der Regel nur eine Seite.

```python
from pathlib import Path
from mängelmelder_test_crawl import aktualisiere_maengelbestand

gesamt_json = aktualisiere_maengelbestand(
    json_output_path=Path("maengelmelder_daten/maengel.json"),
    minimal_json_output_path=Path("maengelmelder_daten/statistik_minimal.json"),
    html_output_directory=Path("maengelmelder_daten"),
    max_pages=5,
    rows=100,
    request_timeout=15.0,
    delay_seconds=1.0,
)
```

`json_output_path` dient gleichzeitig als Eingabe und atomar aktualisierte
Ausgabe. Existiert die Datei noch nicht, wird ein Erstbestand aufgebaut. Dieser
Erstlauf endet spätestens nach `max_pages`; der Standard bleibt bewusst bei
fünf Seiten mit je 100 Zeilen. Mit `None` lassen sich die jeweilige JSON-Ausgabe
oder der optionale HTML-Cache deaktivieren. Die fertige Gesamt-JSON wird immer
zusätzlich als String zurückgegeben.

Dieselbe Verarbeitung ist über die Kommandozeile verfügbar:

```powershell
python ".\mängelmelder_test_crawl.py" aktualisieren `
  --max-pages 5 `
  --rows 100 `
  --json-output ".\maengelmelder_daten\maengel.json" `
  --minimal-output ".\maengelmelder_daten\statistik_minimal.json" `
  --request-timeout 15 `
  --delay-seconds 1
```

Das Ergebnis dokumentiert den Lauf unter `aktualisierung`, darunter Anzahl der
abgerufenen Seiten, neue Meldungen und den Abbruchgrund
`bekannte_id_gefunden`, `keine_weitere_seite` oder `max_pages_erreicht`.

## Minimale Statistik-JSON

`erstelle_minimale_statistik_json(...)` nimmt wahlweise das vollständige
Analyse-Dictionary oder den vollständigen JSON-String entgegen. Zurückgegeben
wird eine kleine Statistik-JSON mit ausschließlich:

- Gesamtzahl der lokal ausgewerteten Mängel
- Vollständigkeitskennzeichen
- frühestem und spätestem Meldedatum
- Anzahl je Status
- Anzahl je Kategorie

Meldungs-IDs, Orte, Beschreibungen und Detail-Links sind darin nicht enthalten:

```python
from mängelmelder_test_crawl import erstelle_minimale_statistik_json

statistik_json = erstelle_minimale_statistik_json(gesamt_json)
```

## Lokales Dashboard auf Port 8000

Das Dashboard wird nicht mehr als einzelne HTML-Datei geöffnet. Der lokale
Server liefert das getrennte Frontend aus `web`, die beiden Datenendpunkte und
einen begrenzten Hintergrundjob für den Refresh-Button:

- `GET /api/maengel` für `maengelmelder_daten/maengel.json`
- `GET /api/statistik` für `maengelmelder_daten/statistik_minimal.json`
- `POST /api/aktualisieren` startet genau einen inkrementellen Abruf
- `GET /api/aktualisierungsstatus` liefert dessen aktuellen Zustand

Der Aktualisierungslauf verwendet serverseitig fest `max_pages=5` und
`rows=100`. Parallele Läufe werden abgewiesen. Die Oberfläche fragt den Status
einmal pro Sekunde ab und lädt beide JSON-Dateien erst nach erfolgreichem
Abschluss neu. Der POST-Endpunkt akzeptiert nur Anfragen mit dem vorgesehenen
Dashboard-Request-Header.

Standardmäßig bindet der Server ausschließlich an `127.0.0.1`. Dadurch ist die
Testanwendung nicht ohne weitere, ausdrückliche Konfiguration im lokalen
Netzwerk erreichbar.

Kompletter Testablauf im Projektverzeichnis:

```powershell
python ".\mängelmelder_test_crawl.py" aktualisieren `
  --max-pages 5 `
  --rows 100 `
  --json-output ".\maengelmelder_daten\maengel.json" `
  --minimal-output ".\maengelmelder_daten\statistik_minimal.json"

python ".\dashboard_server.py" --port 8000
```

Nach Änderungen an `dashboard_server.py` muss ein bereits laufender Server mit
`Strg+C` beendet und mit diesem Befehl neu gestartet werden. Ein einfacher
Static-/Live-Server kann die Python-Crawler-Funktion nicht aufrufen und liefert
für `POST /api/aktualisieren` deshalb zwangsläufig HTTP 404.

Die Serverkonsole protokolliert Uhrzeit, HTTP-Methode, sicheren Pfad und Status,
beispielsweise `HTTP POST /api/aktualisieren -> 202`. Für Aktualisierungsläufe
werden außerdem Start, neue und gesamte Meldungen, geprüfte Seiten sowie der
Abbruchgrund ausgegeben. Query-Parameter und Meldungsinhalte werden nicht
protokolliert. Direkt neben dem Refresh-Button zeigt die Oberfläche denselben
Laufzustand dauerhaft an und meldet fehlende Serverantworten ausdrücklich.

Anschließend im Browser öffnen:

```text
http://127.0.0.1:8000/
```

Der Server läuft im Vordergrund und wird mit `Strg+C` beendet. Ein direktes
Öffnen von `web/index.html` als `file://` ist nicht unterstützt. Die Seite zeigt
einen sichtbaren Fehlerstatus, wenn eine der beiden JSON-Dateien fehlt oder ein
unerwartetes Format besitzt. Ein erneutes Laden der Seite liest beide
Serverdateien noch einmal ein.

### Dashboard-Funktionen

- manueller Refresh-Button für den inkrementellen Hintergrundabruf mit
  sichtbarem Lauf- und Fehlerstatus
- dauerhaft sichtbare und einklappbare Seitennavigation; im eingeklappten
  Zustand nutzt der Inhalt die zusätzlich verfügbare Bildschirmbreite
- Zeitraumfilter direkt am Zeitdiagramm für 7, 14, 30, 90, 180 und 365 Tage,
  Gesamtbestand oder einen frei gewählten Datumsbereich; Standard sind 30 Tage
- direkt am Diagramm umschaltbare tägliche beziehungsweise wöchentliche
  Zeitachse; bis 31 Werte werden Punkte und engere Tagesgrenzen gezeigt, bei
  längeren Zeiträumen wechselt die Darstellung automatisch auf eine ruhige
  durchgehende Linie. Exakte Werte erscheinen beim Darüberfahren.
- Kennzahlen für Gesamtmenge, gelöste und aktive Meldungen, Tagesdurchschnitt
  sowie Meldungen der letzten sieben Tage
- sichtbarer Spitzentag im gewählten Zeitraum
- Karten je Meldekategorie mit Volumen, Anteil, aktivem Bestand und
  Lösungsquote
- eigene Detailseite je Kategorie mit kategoriespezifischen Kennzahlen,
  konfigurierbarem Tages-/Wochenverlauf, Suche, Statusfilter und paginierter
  Meldungsliste
- Meldungskarten mit Ort, Kategorie, validiertem Meldungslink, Volltextsuche
  und wählbaren Seitengrößen von 10, 15, 25 oder 50 Einträgen
- vollständig klickbare Meldungskarten, die über die in der
  Gesamt-JSON gespeicherte `detail_url` zum Originaleintrag führen
- CSV-Export des aktuell gefilterten Datenbestands
- bildschirmfüllende Gesamtübersicht mit schrittweise verdichtbarer Anzeige
  der tatsächlich verfügbaren Kennzahlen
- interaktive, zoombare und verschiebbare Kartenfläche für Ludwigshafen; bis
  zur fachlichen und datenschutzrechtlichen Freigabe ohne externen
  Kartenanbieter und ohne Fachdaten

## Aufbau der Analyse

`analysiere_html_seite(html_path)` verarbeitet eine einzelne HTML-Datei. Pro
Meldung werden folgende Felder extrahiert:

- Meldungs-ID
- Beschreibung aus der Listenansicht
- Kennzeichnung, ob die Beschreibung erkennbar gekürzt ist
- vollständiger Ort aus dem zugänglichen HTML-Label
- Meldedatum im ISO-Format `YYYY-MM-DD`
- Kategorie und Status
- validierter HTTPS-Link zur Detailseite
- Information, ob ein Bild vorhanden ist
- Herkunftsdatei, Seitennummer und Position innerhalb der Seite

`fasse_html_seiten_zusammen(html_directory)` ruft die Einzelanalyse für alle
lokalen HTML-Dateien auf. Die Funktion führt Meldungen anhand ihrer ID zusammen
und dokumentiert:

- Anzahl analysierter Seiten und Datensätze
- vom Portal gemeldete Gesamtzahl
- Duplikate und widersprüchliche Duplikate
- fehlende oder unerwartet formatierte Felder
- Abweichungen bei den Gesamtzahlen verschiedener Seiten

Unvollständige Datensätze werden nicht stillschweigend verworfen. Probleme
erscheinen im Abschnitt `datenqualitaet` der JSON-Datei.

## JSON-Struktur

Die oberste Struktur ist:

```json
{
  "schema_version": "1.0",
  "erstellt_am": "2026-11-09T12:00:27+00:00",
  "quelle": {},
  "abdeckung": {},
  "datenqualitaet": {},
  "maengel": []
}
```

`abdeckung.vollstaendig` ist nur dann `true`, wenn die Anzahl eindeutiger lokal
extrahierter Meldungen der vom Portal angegebenen Gesamtzahl entspricht. Die
konkreten Zahlen stehen immer in der erzeugten JSON, weil sich die lokalen
Dateien durch neue Crawlläufe ändern können. Eine JSON mit
`abdeckung.vollstaendig: false` ist ausdrücklich nur eine Auswertung der lokal
vorhandenen Seiten und nicht des vollständigen Portalbestands.

Die Beschreibung stammt aus der Listenansicht und kann bereits dort gekürzt
sein. Für den vollständigen Meldungstext wäre eine gesondert geprüfte und
freigegebene Detailseitenanbindung erforderlich.

## Tests

```powershell
python -m unittest -v
```

Die Tests prüfen Einzelseitenanalyse, initialen Aufbau, inkrementelles
Zusammenführen, den sofortigen Stopp bei bekannten IDs, die Seitenbegrenzung
und das atomische Schreiben beider UTF-8-JSON-Dateien. Die Testdaten sind
vollständig synthetisch; es findet dabei kein Netzwerkabruf statt.

## Reiner HTML-Abruf für Offline-Diagnosen

Für Diagnosezwecke bleibt ein ausdrücklich aufzurufender Befehl erhalten, der
nur HTML-Dateien speichert und den Gesamtbestand nicht verändert:

```powershell
python ".\mängelmelder_test_crawl.py" crawl `
  --start-page 1 `
  --max-pages 5 `
  --rows 100
```

Der Crawler verwendet ein Timeout, lädt höchstens die angegebene Seitenzahl und
wartet zwischen Abrufen eine Sekunde. Er überschreibt gleichnamige lokale
Seitendateien. Automatisierte oder regelmäßige Abrufe dürfen erst nach Prüfung
und Freigabe von Nutzungsbedingungen, zulässiger Last und betrieblicher
Verantwortung eingerichtet werden.

Für den Crawl-Befehl wird das Paket `requests` benötigt. Die reine Analyse
funktioniert ausschließlich mit der Python-Standardbibliothek.

## Sicherheit und Datenschutz

- HTML-Eingaben werden als nicht vertrauenswürdig behandelt und nicht
  ausgeführt.
- Pro HTML-Datei gilt eine Größenbegrenzung von 5 MiB.
- Detail-Links werden nur für den erwarteten HTTPS-Host akzeptiert.
- Externe Bild-URLs werden nicht in die JSON übernommen. Eine vorhandene
  Listenseite enthält eine URL mit Zugriffstoken; exportiert wird deshalb nur
  das boolesche Feld `hat_bild`.
- Die erzeugte JSON kann Ortsangaben und Meldungsbeschreibungen enthalten und
  ist daher entsprechend der noch festzulegenden Datenklassifikation zu
  behandeln.
- Es findet keine automatische Veröffentlichung, Übertragung oder Bereitstellung
  der Daten statt.

Weitere fachliche, technische und organisatorische Rahmenbedingungen stehen in
`Projektkontext_Stadtverwaltung_Ludwigshafen_Dashboard.md` und `AGENTS.md`.


