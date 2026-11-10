import importlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


modul = importlib.import_module("mängelmelder_test_crawl")


HTML_TEMPLATE = """
<div class="media message-short-tile" id="message123">
  <div class="media-left has-picture"><div class="image-container"><img src="https://example.invalid/token"></div></div>
  <div class="media-body">
    <div class="message-detail-position" aria-label="Ort Teststraße 1, Ludwigshafen"><strong>Ort:</strong> gekürzt...</div>
    <a href="https://ludwigshafen.maengelmelder.de/bms/123"><div class="media-heading">Testmangel ... (Nr. 123)</div></a>
    <div>
      <span class="wdw-details"><strong>Meldung Nr.</strong> 123</span>
      <span class="wdw-details"><strong>Gemeldet am</strong> 09.11.2026</span>
      <span class="wdw-details"><b>Kategorie:</b> Testkategorie</span>
      <span class="wdw-details"><b>Status:</b> in Bearbeitung</span>
    </div>
  </div>
</div>
<span id="wdw-pager-total-entries" data-entries-count="2">Meldungen</span>
"""


def html_mit_ids(*message_ids: str, total: int | None = None) -> str:
    tiles = []
    for message_id in message_ids:
        tile = HTML_TEMPLATE.split('<span id="wdw-pager-total-entries"', 1)[0]
        tiles.append(tile.replace("123", message_id))
    reported_total = total if total is not None else len(message_ids)
    return "".join(tiles) + (
        f'<span id="wdw-pager-total-entries" data-entries-count="{reported_total}">Meldungen</span>'
    )


class MaengelmelderAnalyseTests(unittest.TestCase):
    def test_analysiert_eine_seite_ohne_bild_url(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            path = Path(temp_directory) / "seite_1.html"
            path.write_text(HTML_TEMPLATE, encoding="utf-8")
            result = modul.analysiere_html_seite(path)

        self.assertEqual(result["anzahl_maengel"], 1)
        record = result["maengel"][0]
        self.assertEqual(record["id"], "123")
        self.assertEqual(record["ort"], "Teststraße 1, Ludwigshafen")
        self.assertEqual(record["gemeldet_am"], "2026-11-09")
        self.assertTrue(record["beschreibung_gekuerzt"])
        self.assertTrue(record["hat_bild"])
        self.assertNotIn("bild_url", record)
        self.assertEqual(result["fehler"], [])

    def test_fasst_seiten_zusammen_und_meldet_duplikate(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            directory = Path(temp_directory)
            (directory / "seite_1.html").write_text(HTML_TEMPLATE, encoding="utf-8")
            (directory / "seite_2.html").write_text(HTML_TEMPLATE, encoding="utf-8")
            result = modul.fasse_html_seiten_zusammen(directory)

        self.assertEqual(result["abdeckung"]["extrahierte_eintraege_vor_deduplizierung"], 2)
        self.assertEqual(result["abdeckung"]["eindeutige_maengel"], 1)
        self.assertFalse(result["abdeckung"]["vollstaendig"])
        self.assertEqual(len(result["datenqualitaet"]["doppelte_ids"]), 1)
        self.assertEqual(len(result["datenqualitaet"]["widerspruechliche_doppelte_ids"]), 0)

    def test_schreibt_gueltiges_utf8_json(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            output = Path(temp_directory) / "maengel.json"
            modul.schreibe_json({"ort": "Teststraße"}, output)
            self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["ort"], "Teststraße")
            self.assertFalse(output.with_suffix(".json.tmp").exists())

    def test_aktualisierung_merged_neue_meldung_und_stoppt_bei_bekannter_id(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            directory = Path(temp_directory)
            (directory / "seite_1.html").write_text(HTML_TEMPLATE, encoding="utf-8")
            output = directory / "gesamt.json"
            modul.schreibe_json(modul.fasse_html_seiten_zusammen(directory), output)
            session = MagicMock()
            with (
                patch.object(modul, "_konfiguriere_http_session", return_value=session),
                patch.object(modul, "_lade_listenseite", return_value=html_mit_ids("124", "123", total=2)) as load,
            ):
                result_json = modul.aktualisiere_maengelbestand(
                    json_output_path=output,
                    minimal_json_output_path=directory / "minimal.json",
                    html_output_directory=directory,
                    max_pages=5,
                    delay_seconds=0,
                )

            result = json.loads(result_json)
            load.assert_called_once_with(session, 1, 100, 15.0)
            self.assertEqual([record["id"] for record in result["maengel"]], ["124", "123"])
            self.assertEqual(result["aktualisierung"]["neue_maengel"], 1)
            self.assertEqual(result["aktualisierung"]["abbruchgrund"], "bekannte_id_gefunden")
            self.assertEqual(json.loads(output.read_text(encoding="utf-8"))["maengel"][0]["id"], "124")
            self.assertEqual(json.loads((directory / "minimal.json").read_text(encoding="utf-8"))["anzahl_maengel"], 2)

    def test_aktualisierung_crawlt_weiter_bis_eine_bekannte_id_erscheint(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            directory = Path(temp_directory)
            (directory / "seite_1.html").write_text(HTML_TEMPLATE, encoding="utf-8")
            output = directory / "gesamt.json"
            modul.schreibe_json(modul.fasse_html_seiten_zusammen(directory), output)
            session = MagicMock()
            with (
                patch.object(modul, "_konfiguriere_http_session", return_value=session),
                patch.object(
                    modul,
                    "_lade_listenseite",
                    side_effect=[html_mit_ids("125", "124", total=3), html_mit_ids("123", total=3)],
                ) as load,
            ):
                result = json.loads(modul.aktualisiere_maengelbestand(
                    json_output_path=output,
                    minimal_json_output_path=None,
                    html_output_directory=None,
                    max_pages=5,
                    delay_seconds=0,
                ))

        self.assertEqual(load.call_count, 2)
        self.assertEqual([record["id"] for record in result["maengel"]], ["125", "124", "123"])
        self.assertEqual(result["aktualisierung"]["abgerufene_seiten"], 2)

    def test_erstbestand_respektiert_max_pages(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            directory = Path(temp_directory)
            session = MagicMock()
            with (
                patch.object(modul, "_konfiguriere_http_session", return_value=session),
                patch.object(
                    modul,
                    "_lade_listenseite",
                    side_effect=[html_mit_ids("125", total=2), html_mit_ids("124", total=2)],
                ) as load,
            ):
                result = json.loads(modul.aktualisiere_maengelbestand(
                    json_output_path=directory / "gesamt.json",
                    minimal_json_output_path=None,
                    html_output_directory=None,
                    max_pages=2,
                    delay_seconds=0,
                ))

        self.assertEqual(load.call_count, 2)
        self.assertEqual(result["aktualisierung"]["modus"], "erstbestand")
        self.assertEqual(result["aktualisierung"]["abbruchgrund"], "max_pages_erreicht")
        self.assertTrue(result["abdeckung"]["vollstaendig"])

    def test_minimalstatistik_enthaelt_keine_einzelfalldaten(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            path = Path(temp_directory) / "seite_1.html"
            path.write_text(HTML_TEMPLATE, encoding="utf-8")
            full_result = modul.fasse_html_seiten_zusammen(path.parent)

        minimal_json = modul.erstelle_minimale_statistik_json(full_result)
        minimal = json.loads(minimal_json)
        self.assertEqual(minimal["anzahl_maengel"], 1)
        self.assertEqual(minimal["zeitraum"], {"von": "2026-11-09", "bis": "2026-11-09"})
        self.assertEqual(minimal["nach_status"], {"in Bearbeitung": 1})
        self.assertNotIn("maengel", minimal)
        self.assertNotIn("Teststraße", minimal_json)
        self.assertNotIn("123", minimal_json)

    def test_minimalstatistik_fasst_abgeschlossen_und_geloest_zusammen(self):
        analyse = {
            "abdeckung": {"vollstaendig": False},
            "maengel": [
                {"status": "Gelöst", "gemeldet_am": "2026-11-09"},
                {"status": "Ungelöst Abgeschlossen", "gemeldet_am": "2026-11-10"},
            ],
        }

        minimal = json.loads(modul.erstelle_minimale_statistik_json(analyse))

        self.assertEqual(minimal["nach_status"], {"Gelöst": 2})


if __name__ == "__main__":
    unittest.main()
