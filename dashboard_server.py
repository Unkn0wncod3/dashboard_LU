"""Lokaler HTTP-Server fuer das Mängelmelder-Dashboard.

Der Server stellt Dateien aus ``web``, eng begrenzte JSON-Endpunkte und einen
einzelnen Hintergrundjob fuer die inkrementelle Aktualisierung bereit. Er
bindet standardmaessig nur an localhost.
"""

from __future__ import annotations

import argparse
import importlib
import json
import logging
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable, Final
from urllib.parse import urlsplit


PROJECT_DIRECTORY: Final = Path(__file__).resolve().parent
DEFAULT_WEB_DIRECTORY: Final = PROJECT_DIRECTORY / "web"
DEFAULT_DATA_DIRECTORY: Final = PROJECT_DIRECTORY / "maengelmelder_daten"
DEFAULT_HOST: Final = "127.0.0.1"
DEFAULT_PORT: Final = 8000
LOGGER = logging.getLogger("dashboard_server")


class RefreshCoordinator:
    """Startet hoechstens einen Crawl gleichzeitig und liefert dessen Status."""

    def __init__(
        self,
        data_directory: Path,
        refresh_function: Callable[..., str] | None = None,
    ) -> None:
        self.data_directory = Path(data_directory)
        self.refresh_function = refresh_function or self._default_refresh
        self._lock = threading.Lock()
        self._status: dict[str, Any] = {"status": "bereit"}

    @staticmethod
    def _default_refresh(**kwargs: Any) -> str:
        crawler = importlib.import_module("mängelmelder_test_crawl")
        return crawler.aktualisiere_maengelbestand(**kwargs)

    def status(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._status)

    def start(self) -> bool:
        with self._lock:
            if self._status.get("status") == "laeuft":
                LOGGER.warning("REFRESH abgewiesen | Grund=bereits_aktiv")
                return False
            self._status = {
                "status": "laeuft",
                "gestartet_am": datetime.now(timezone.utc).isoformat(),
            }
        LOGGER.info("REFRESH gestartet | max_pages=5 | rows=100")
        threading.Thread(target=self._run, name="maengelmelder-refresh", daemon=True).start()
        return True

    def _run(self) -> None:
        try:
            result_json = self.refresh_function(
                json_output_path=self.data_directory / "maengel.json",
                minimal_json_output_path=self.data_directory / "statistik_minimal.json",
                html_output_directory=self.data_directory,
                max_pages=5,
                rows=100,
                request_timeout=15.0,
                delay_seconds=1.0,
            )
            result = json.loads(result_json)
            refresh = result.get("aktualisierung", {})
            status = {
                "status": "erfolgreich",
                "beendet_am": datetime.now(timezone.utc).isoformat(),
                "neue_maengel": int(refresh.get("neue_maengel", 0)),
                "gesamt": int(result.get("abdeckung", {}).get("eindeutige_maengel", 0)),
                "abgerufene_seiten": int(refresh.get("abgerufene_seiten", 0)),
                "abbruchgrund": str(refresh.get("abbruchgrund", "unbekannt")),
            }
            LOGGER.info(
                "REFRESH erfolgreich | neue_maengel=%s | gesamt=%s | seiten=%s | abbruchgrund=%s",
                status["neue_maengel"],
                status["gesamt"],
                status["abgerufene_seiten"],
                status["abbruchgrund"],
            )
        except Exception as error:  # Der alte Datenbestand bleibt durch atomare Schreibvorgaenge erhalten.
            LOGGER.error("REFRESH fehlgeschlagen | fehlertyp=%s | alter_bestand_bleibt_erhalten=true", type(error).__name__)
            status = {
                "status": "fehler",
                "beendet_am": datetime.now(timezone.utc).isoformat(),
                "meldung": "Die Aktualisierung ist fehlgeschlagen; der bisherige Datenbestand bleibt erhalten.",
            }
        with self._lock:
            self._status = status


class DashboardRequestHandler(SimpleHTTPRequestHandler):
    """Statisches Frontend mit eng begrenzten JSON-Endpunkten."""

    data_directory = DEFAULT_DATA_DIRECTORY
    refresh_coordinator = RefreshCoordinator(DEFAULT_DATA_DIRECTORY)
    api_files: Final = {
        "/api/maengel": "maengel.json",
        "/api/statistik": "statistik_minimal.json",
    }

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/aktualisierungsstatus":
            self._send_json(200, self.refresh_coordinator.status())
            return
        if path in self.api_files:
            self._serve_json(self.data_directory / self.api_files[path])
            return
        super().do_GET()

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        if path != "/api/aktualisieren":
            LOGGER.warning("API unbekannt | methode=POST | pfad=%s", path)
            self.send_error(404)
            return
        if self.headers.get("X-Dashboard-Request") != "1":
            self._send_json(403, {"fehler": "Ungueltige Aktualisierungsanfrage."})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"fehler": "Ungueltige Anfragegroesse."})
            return
        if content_length != 0:
            self._send_json(400, {"fehler": "Die Aktualisierungsanfrage darf keinen Inhalt enthalten."})
            return
        if not self.refresh_coordinator.start():
            self._send_json(409, self.refresh_coordinator.status())
            return
        self._send_json(202, self.refresh_coordinator.status())

    def _send_json(self, status_code: int, payload: dict[str, Any]) -> None:
        content = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def _serve_json(self, path: Path) -> None:
        try:
            content = path.read_bytes()
        except OSError:
            content = json.dumps(
                {"fehler": "Die lokale JSON-Datei ist nicht verfügbar."},
                ensure_ascii=False,
            ).encode("utf-8")
            self.send_response(503)
        else:
            self.send_response(200)

        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; connect-src 'self'; img-src 'self' data:; "
            "script-src 'self'; style-src 'self' 'unsafe-inline'; base-uri 'none'; "
            "form-action 'self'; frame-ancestors 'none'",
        )
        super().end_headers()

    def log_message(self, message_format: str, *args: object) -> None:
        # Query-Parameter und Inhalte werden bewusst nicht protokolliert.
        if message_format.startswith('"') and len(args) > 1:
            LOGGER.info(
                "HTTP %s %s -> %s | client=%s",
                self.command,
                urlsplit(self.path).path,
                args[1],
                self.client_address[0],
            )


def create_server(
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    *,
    web_directory: Path = DEFAULT_WEB_DIRECTORY,
    data_directory: Path = DEFAULT_DATA_DIRECTORY,
    refresh_function: Callable[..., str] | None = None,
) -> ThreadingHTTPServer:
    """Erzeugt einen konfigurierten Server; hilfreich fuer Start und Tests."""

    if not 0 <= port <= 65535:
        raise ValueError("Port muss zwischen 0 und 65535 liegen")
    web_directory = Path(web_directory).resolve()
    data_directory = Path(data_directory).resolve()
    if not (web_directory / "index.html").is_file():
        raise ValueError(f"Frontend fehlt: {web_directory / 'index.html'}")

    class ConfiguredHandler(DashboardRequestHandler):
        pass

    ConfiguredHandler.data_directory = data_directory
    ConfiguredHandler.refresh_coordinator = RefreshCoordinator(data_directory, refresh_function)

    def handler(*args: object, **kwargs: object) -> ConfiguredHandler:
        return ConfiguredHandler(*args, directory=str(web_directory), **kwargs)

    return ThreadingHTTPServer((host, port), handler)


def _argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lokales Mängelmelder-Dashboard starten")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Standard: nur localhost")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    return parser


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%H:%M:%S",
    )
    args = _argument_parser().parse_args()
    server = create_server(args.host, args.port)
    actual_host, actual_port = server.server_address[:2]
    LOGGER.info("SERVER gestartet | url=http://%s:%s | refresh_api=POST /api/aktualisieren", actual_host, actual_port)
    LOGGER.info("SERVER beenden mit Strg+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        LOGGER.info("SERVER wird beendet")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
