import json
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

from dashboard_server import RefreshCoordinator, create_server


class RefreshCoordinatorTests(unittest.TestCase):
    def test_aktualisierung_laeuft_im_hintergrund_mit_festen_grenzen(self):
        captured = {}

        def refresh(**kwargs):
            captured.update(kwargs)
            return json.dumps({
                "aktualisierung": {
                    "neue_maengel": 2,
                    "abgerufene_seiten": 1,
                    "abbruchgrund": "bekannte_id_gefunden",
                },
                "abdeckung": {"eindeutige_maengel": 12},
            })

        coordinator = RefreshCoordinator(Path("daten"), refresh)
        with self.assertLogs("dashboard_server", level="INFO") as logs:
            self.assertTrue(coordinator.start())
            for _ in range(100):
                if coordinator.status()["status"] != "laeuft":
                    break
                time.sleep(0.01)

        self.assertEqual(coordinator.status()["status"], "erfolgreich")
        self.assertEqual(coordinator.status()["neue_maengel"], 2)
        self.assertEqual(captured["max_pages"], 5)
        self.assertEqual(captured["rows"], 100)
        self.assertTrue(any("REFRESH gestartet" in entry for entry in logs.output))
        self.assertTrue(any("REFRESH erfolgreich" in entry for entry in logs.output))

    def test_parallele_aktualisierung_wird_abgewiesen(self):
        started = threading.Event()
        release = threading.Event()

        def refresh(**_kwargs):
            started.set()
            release.wait(timeout=2)
            return json.dumps({"aktualisierung": {}, "abdeckung": {}})

        coordinator = RefreshCoordinator(Path("daten"), refresh)
        self.assertTrue(coordinator.start())
        self.assertTrue(started.wait(timeout=1))
        self.assertFalse(coordinator.start())
        release.set()


class DashboardServerTests(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        root = Path(self.temp_directory.name)
        web = root / "web"
        data = root / "data"
        web.mkdir()
        data.mkdir()
        (web / "index.html").write_text("<!doctype html><title>Test</title>", encoding="utf-8")
        (data / "maengel.json").write_text('{"maengel": []}', encoding="utf-8")
        (data / "statistik_minimal.json").write_text('{"anzahl_maengel": 0}', encoding="utf-8")
        self.refresh_calls = []

        def refresh(**kwargs):
            self.refresh_calls.append(kwargs)
            return json.dumps({
                "aktualisierung": {
                    "neue_maengel": 1,
                    "abgerufene_seiten": 1,
                    "abbruchgrund": "bekannte_id_gefunden",
                },
                "abdeckung": {"eindeutige_maengel": 1},
            })

        self.server = create_server(
            "127.0.0.1",
            0,
            web_directory=web,
            data_directory=data,
            refresh_function=refresh,
        )
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.temp_directory.cleanup()

    def test_liefert_frontend_und_beide_json_endpunkte(self):
        with urllib.request.urlopen(f"{self.base_url}/", timeout=2) as response:
            self.assertEqual(response.status, 200)
            self.assertIn("text/html", response.headers["Content-Type"])

        for route in ("/api/maengel", "/api/statistik"):
            with urllib.request.urlopen(f"{self.base_url}{route}", timeout=2) as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers["Cache-Control"], "no-store")
                self.assertIsInstance(json.load(response), dict)

    def test_verzeichnis_ausserhalb_von_web_ist_nicht_erreichbar(self):
        with self.assertRaises(urllib.error.HTTPError) as context:
            urllib.request.urlopen(f"{self.base_url}/../data/maengel.json", timeout=2)
        self.assertEqual(context.exception.code, 404)

    def test_refresh_endpoint_ruft_crawlerfunktion_auf(self):
        request = urllib.request.Request(
            f"{self.base_url}/api/aktualisieren",
            data=b"",
            method="POST",
            headers={"X-Dashboard-Request": "1"},
        )
        with urllib.request.urlopen(request, timeout=2) as response:
            self.assertEqual(response.status, 202)

        for _ in range(100):
            with urllib.request.urlopen(f"{self.base_url}/api/aktualisierungsstatus", timeout=2) as response:
                status = json.load(response)
            if status["status"] != "laeuft":
                break
            time.sleep(0.01)

        self.assertEqual(status["status"], "erfolgreich")
        self.assertEqual(len(self.refresh_calls), 1)
        self.assertEqual(self.refresh_calls[0]["max_pages"], 5)
        self.assertEqual(self.refresh_calls[0]["rows"], 100)


if __name__ == "__main__":
    unittest.main()
