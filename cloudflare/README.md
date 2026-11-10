# Optionale Cloudflare-Bereitstellung

Dieser Ordner kapselt die komplette Cloudflare-Erweiterung. Die bestehende lokale
Python-Anwendung und `web/` werden nicht verändert. Wenn die Erweiterung nicht
mehr gebraucht wird, kann der Ordner `cloudflare/` vollständig entfernt werden.

## Was bereitgestellt wird

- das vorhandene Frontend aus `../web/`
- ein statischer Snapshot aus `../maengelmelder_daten/maengel.json`
- die Minimalstatistik aus `../maengelmelder_daten/statistik_minimal.json`
- ein kleiner Worker für die vorhandenen lesenden `/api/*`-Endpunkte

Die Cloudflare-Version führt bewusst **keinen Crawl und keinen manuellen Import**
aus. Neue Daten werden erst mit einem neuen, fachlich freigegebenen Deployment
veröffentlicht. Der Aktualisieren-Knopf wird nur im erzeugten Cloudflare-Paket
ausgeblendet.

## Voraussetzungen und Freigaben

- Node.js 22 oder neuer in einer von Wrangler unterstützten Version
- ein freigegebenes Cloudflare-Konto und ein freigegebener Zielbereich
- bestätigte Datenschutz-, Schutzbedarfs-, Vertrags- und Betriebsfreigabe
- fachliche Prüfung des zu veröffentlichenden JSON-Datenstands

Der Build kopiert die beiden JSON-Dateien in das Deployment-Paket. Vor einem
echten Deployment muss deshalb ausdrücklich bestätigt sein, dass diese Daten an
Cloudflare übertragen und öffentlich über die Dashboard-API ausgeliefert werden
dürfen. Zugangsdaten gehören nicht in diesen Ordner; Wrangler verwaltet die
Anmeldung außerhalb des Repositorys.

## Lokal prüfen

Im Ordner `cloudflare/`:

```powershell
npm install
npm test
npm run dev
```

`npm run build` erzeugt ausschließlich `cloudflare/dist/`. Dieser Ausgabeordner
ist ignoriert und kann jederzeit neu gebaut werden.

Ein Cloudflare-Dry-Run ohne Veröffentlichung:

```powershell
npm run deploy:dry-run
```

## Deployment nach ausdrücklicher Freigabe

```powershell
npx wrangler login
npm run deploy
```

Der Workername kann vorab in `wrangler.jsonc` geändert werden. Domain, Zugriff,
Authentifizierung und Wallboard-Freigabe sind bewusst nicht voreingestellt und
müssen durch die zuständigen Stellen festgelegt werden.

## Vollständig entfernen

Lokal genügt es, ausschließlich den Ordner `cloudflare/` zu löschen. Ein bereits
veröffentlichter Worker muss zusätzlich kontrolliert im Cloudflare-Konto gelöscht
werden; das Entfernen lokaler Dateien löscht keine externe Bereitstellung.

