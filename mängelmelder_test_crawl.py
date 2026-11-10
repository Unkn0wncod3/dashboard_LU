"""Inkrementeller Crawler und Offline-Analyse fuer den Maengelmelder.

Abruf, HTML-Analyse, Zusammenfuehrung und JSON-Ausgaben liegen bewusst in
diesem einen Adaptermodul. Externe Bild-URLs werden nicht exportiert, weil sie
Zugriffstoken enthalten koennen. Die HTML-Listen enthalten teilweise gekuerzte
Beschreibungstexte.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse


URL = "https://ludwigshafen.maengelmelder.de/bms/list.ajax"
DETAIL_HOST = "ludwigshafen.maengelmelder.de"
DEFAULT_OUTPUT_DIRECTORY = Path("maengelmelder_daten")
DEFAULT_JSON_PATH = DEFAULT_OUTPUT_DIRECTORY / "maengel.json"
DEFAULT_MINIMAL_JSON_PATH = DEFAULT_OUTPUT_DIRECTORY / "statistik_minimal.json"
MAX_HTML_BYTES = 5 * 1024 * 1024
MESSAGE_ID_PATTERN = re.compile(r"^message(?P<id>\d+)$")
TITLE_ID_PATTERN = re.compile(r"\s*\(Nr\.\s*(?P<id>\d+)\)\s*$")
PAGE_NUMBER_PATTERN = re.compile(r"(\d+)$")


@dataclass
class HtmlNode:
    """Kleiner, toleranter DOM-Knoten fuer die benoetigte Offline-Analyse."""

    tag: str
    attrs: dict[str, str]
    children: list["HtmlNode"] = field(default_factory=list)
    text_parts: list[str] = field(default_factory=list)

    @property
    def classes(self) -> set[str]:
        return set(self.attrs.get("class", "").split())

    def text(self) -> str:
        parts = list(self.text_parts)
        for child in self.children:
            parts.append(child.text())
        return " ".join(" ".join(parts).split())

    def descendants(self) -> Iterable["HtmlNode"]:
        for child in self.children:
            yield child
            yield from child.descendants()


class HtmlTreeParser(HTMLParser):
    """Baut ohne Skriptausfuehrung einen fuer die Extraktion ausreichenden Baum."""

    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = HtmlNode("document", {})
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = HtmlNode(tag.lower(), {name.lower(): value or "" for name, value in attrs})
        self.stack[-1].children.append(node)
        if tag.lower() not in self.VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if self.stack[-1].tag == tag.lower():
            self.stack.pop()

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.stack[-1].text_parts.append(data)


def _first_descendant(node: HtmlNode, *, tag: str | None = None, class_name: str | None = None) -> HtmlNode | None:
    for candidate in node.descendants():
        if tag is not None and candidate.tag != tag:
            continue
        if class_name is not None and class_name not in candidate.classes:
            continue
        return candidate
    return None


def _detail_value(tile: HtmlNode, label: str) -> str | None:
    expected = label.casefold().rstrip(":")
    for node in tile.descendants():
        if "wdw-details" not in node.classes:
            continue
        prefix = _first_descendant(node, tag="strong") or _first_descendant(node, tag="b")
        if prefix is None or prefix.text().casefold().rstrip(":") != expected:
            continue
        # In diesen Spans steht der Feldwert als direkter Text neben dem
        # strong/b-Kindelement. So bleibt die Extraktion unabhaengig davon,
        # wie ein vereinfachter DOM-Baum Kind- und Elterntext zusammenfuegt.
        value = " ".join(" ".join(node.text_parts).split()).lstrip(" :")
        return value or None
    return None


def _safe_detail_url(tile: HtmlNode) -> str | None:
    for node in tile.descendants():
        if node.tag != "a":
            continue
        href = node.attrs.get("href", "")
        parsed = urlparse(href)
        if parsed.scheme == "https" and parsed.hostname == DETAIL_HOST and re.fullmatch(r"/bms/\d+", parsed.path):
            return href
    return None


def _parse_date(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%d.%m.%Y").date().isoformat()
    except ValueError:
        return None


def _page_number(path: Path) -> int | None:
    match = PAGE_NUMBER_PATTERN.search(path.stem)
    return int(match.group(1)) if match else None


def _analysiere_html_inhalt(html: str, *, dateiname: str, seite: int | None) -> dict[str, Any]:
    """Analysiert HTML aus Datei oder HTTP-Antwort ohne Zwischendatei."""

    if len(html.encode("utf-8")) > MAX_HTML_BYTES:
        raise ValueError(f"HTML-Inhalt ist groesser als {MAX_HTML_BYTES} Bytes: {dateiname}")
    parser = HtmlTreeParser()
    parser.feed(html)
    parser.close()

    records: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    tiles = [node for node in parser.root.descendants() if "message-short-tile" in node.classes]
    for position, tile in enumerate(tiles, start=1):
        id_match = MESSAGE_ID_PATTERN.fullmatch(tile.attrs.get("id", ""))
        message_id = id_match.group("id") if id_match else None

        heading = _first_descendant(tile, class_name="media-heading")
        raw_title = heading.text() if heading else ""
        title_id_match = TITLE_ID_PATTERN.search(raw_title)
        title_id = title_id_match.group("id") if title_id_match else None
        title = TITLE_ID_PATTERN.sub("", raw_title).strip() or None

        location_node = _first_descendant(tile, class_name="message-detail-position")
        location_label = location_node.attrs.get("aria-label", "") if location_node else ""
        location = location_label.removeprefix("Ort ").strip() or None

        reported_raw = _detail_value(tile, "Gemeldet am")
        reported_at = _parse_date(reported_raw)
        category = _detail_value(tile, "Kategorie")
        status = _detail_value(tile, "Status")
        detail_url = _safe_detail_url(tile)
        has_image = any(node.tag == "img" for node in tile.descendants())

        record_errors: list[str] = []
        if not message_id:
            record_errors.append("Meldungs-ID fehlt oder ist ungueltig")
        if title_id and message_id and title_id != message_id:
            record_errors.append("Meldungs-ID im Titel weicht von der Kachel-ID ab")
        if not title:
            record_errors.append("Beschreibung fehlt")
        if not location:
            record_errors.append("Ort fehlt")
        if reported_raw and not reported_at:
            record_errors.append("Meldedatum hat ein unerwartetes Format")
        elif not reported_raw:
            record_errors.append("Meldedatum fehlt")
        if not category:
            record_errors.append("Kategorie fehlt")
        if not status:
            record_errors.append("Status fehlt")
        if not detail_url:
            record_errors.append("Sicherer Detail-Link fehlt")

        record = {
            "id": message_id,
            "beschreibung": title,
            "beschreibung_gekuerzt": bool(title and "..." in title),
            "ort": location,
            "gemeldet_am": reported_at,
            "kategorie": category,
            "status": status,
            "detail_url": detail_url,
            "hat_bild": has_image,
            "quelle": {"datei": dateiname, "seite": seite, "position": position},
        }
        records.append(record)
        if record_errors:
            errors.append({"id": message_id, "position": position, "fehler": record_errors})

    total_node = next((node for node in parser.root.descendants() if node.attrs.get("id") == "wdw-pager-total-entries"), None)
    reported_total_raw = total_node.attrs.get("data-entries-count") if total_node else None
    reported_total = int(reported_total_raw) if reported_total_raw and reported_total_raw.isdigit() else None

    return {
        "datei": dateiname,
        "seite": seite,
        "anzahl_maengel": len(records),
        "gemeldete_gesamtzahl": reported_total,
        "maengel": records,
        "fehler": errors,
    }


def analysiere_html_seite(html_path: Path) -> dict[str, Any]:
    """Analysiert eine lokale HTML-Listenseite in ein validierbares Ergebnis.

    Unvollstaendige Meldungen werden nicht verworfen. Fehlende oder unplausible
    Felder erscheinen unter ``fehler``, damit Datenprobleme sichtbar bleiben.
    """

    html_path = Path(html_path)
    size = html_path.stat().st_size
    if size > MAX_HTML_BYTES:
        raise ValueError(f"HTML-Datei ist groesser als {MAX_HTML_BYTES} Bytes: {html_path}")
    return _analysiere_html_inhalt(
        html_path.read_text(encoding="utf-8"),
        dateiname=html_path.name,
        seite=_page_number(html_path),
    )


def fasse_html_seiten_zusammen(
    html_directory: Path,
    *,
    html_files: Iterable[Path] | None = None,
) -> dict[str, Any]:
    """Analysiert HTML-Dateien und konsolidiert sie nach Meldungs-ID.

    Ohne ``html_files`` werden alle ``*.html``-Dateien des Verzeichnisses
    verarbeitet. Ein expliziter Dateisatz verhindert, dass ein einzelner
    Crawllauf mit aelteren Restdateien desselben Ordners vermischt wird.
    """

    html_directory = Path(html_directory)
    candidates = html_directory.glob("*.html") if html_files is None else (Path(path) for path in html_files)
    files = sorted(candidates, key=lambda path: (_page_number(path) is None, _page_number(path) or 0, path.name))
    if not files:
        raise ValueError(f"Keine HTML-Dateien gefunden: {html_directory}")

    pages = [analysiere_html_seite(path) for path in files]
    records_by_id: dict[str, dict[str, Any]] = {}
    records_without_id: list[dict[str, Any]] = []
    duplicates: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []

    for page in pages:
        for record in page["maengel"]:
            message_id = record["id"]
            if message_id is None:
                records_without_id.append(record)
                continue
            existing = records_by_id.get(message_id)
            if existing is None:
                records_by_id[message_id] = record
                continue

            occurrence = {"id": message_id, "behalten": existing["quelle"], "doppelt": record["quelle"]}
            duplicates.append(occurrence)
            comparable_existing = {key: value for key, value in existing.items() if key != "quelle"}
            comparable_record = {key: value for key, value in record.items() if key != "quelle"}
            if comparable_existing != comparable_record:
                conflicts.append(occurrence)

    records = list(records_by_id.values()) + records_without_id
    reported_totals = sorted({page["gemeldete_gesamtzahl"] for page in pages if page["gemeldete_gesamtzahl"] is not None})
    reported_total = reported_totals[0] if len(reported_totals) == 1 else None
    page_errors = [
        {"datei": page["datei"], "seite": page["seite"], "meldungen": page["fehler"]}
        for page in pages
        if page["fehler"]
    ]

    return {
        "schema_version": "1.0",
        "erstellt_am": datetime.now(timezone.utc).isoformat(),
        "quelle": {
            "system": "Maengelmelder Ludwigshafen",
            "listen_endpunkt": URL,
            "eingabe_verzeichnis": str(html_directory),
        },
        "abdeckung": {
            "analysierte_html_seiten": len(files),
            "extrahierte_eintraege_vor_deduplizierung": sum(page["anzahl_maengel"] for page in pages),
            "eindeutige_maengel": len(records),
            "vom_portal_gemeldete_gesamtzahl": reported_total,
            "vollstaendig": reported_total is not None and len(records) == reported_total,
            "hinweis": "Die JSON enthaelt nur Meldungen aus den lokal vorhandenen HTML-Dateien.",
        },
        "datenqualitaet": {
            "seiten_mit_feldfehlern": page_errors,
            "doppelte_ids": duplicates,
            "widerspruechliche_doppelte_ids": conflicts,
            "abweichende_portal_gesamtzahlen": reported_totals if len(reported_totals) > 1 else [],
            "hinweis": "Beschreibungstexte koennen bereits in der HTML-Listenansicht gekuerzt sein; Bild-URLs werden nicht exportiert.",
        },
        "maengel": records,
    }


def schreibe_json(result: dict[str, Any], output_path: Path) -> None:
    """Schreibt UTF-8-JSON atomar, damit keine halbe Ergebnisdatei entsteht."""

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(output_path.suffix + ".tmp")
    temporary_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary_path.replace(output_path)


def erstelle_minimale_statistik_json(analyse: dict[str, Any] | str) -> str:
    """Gibt nur die notwendigsten, nicht einzelfallbezogenen Statistiken aus.

    Akzeptiert entweder das Ergebnis von ``fasse_html_seiten_zusammen`` oder
    einen entsprechenden JSON-String. Orte, Beschreibungen, IDs und Links
    werden nicht in die Minimalstatistik uebernommen.
    """

    document = json.loads(analyse) if isinstance(analyse, str) else analyse
    records = document.get("maengel")
    coverage = document.get("abdeckung")
    if not isinstance(records, list) or not isinstance(coverage, dict):
        raise ValueError("Analyse enthaelt keine gueltigen Felder 'maengel' und 'abdeckung'")

    statuses: dict[str, int] = {}
    categories: dict[str, int] = {}
    dates: list[str] = []
    for record in records:
        if not isinstance(record, dict):
            continue
        status = record.get("status")
        category = record.get("kategorie")
        reported_at = record.get("gemeldet_am")
        if isinstance(status, str) and status:
            status_key = "Gelöst" if re.search(r"abgeschloss|closed", status, re.IGNORECASE) else status
            statuses[status_key] = statuses.get(status_key, 0) + 1
        if isinstance(category, str) and category:
            categories[category] = categories.get(category, 0) + 1
        if isinstance(reported_at, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", reported_at):
            dates.append(reported_at)

    minimal = {
        "anzahl_maengel": len(records),
        "vollstaendig": bool(coverage.get("vollstaendig", False)),
        "zeitraum": {
            "von": min(dates) if dates else None,
            "bis": max(dates) if dates else None,
        },
        "nach_status": dict(sorted(statuses.items())),
        "nach_kategorie": dict(sorted(categories.items())),
    }
    return json.dumps(minimal, ensure_ascii=False, indent=2) + "\n"


def _validiere_abrufparameter(max_pages: int, rows: int, request_timeout: float, delay_seconds: float) -> None:
    if max_pages < 1:
        raise ValueError("max_pages muss mindestens 1 sein")
    if not 1 <= rows <= 100:
        raise ValueError("rows muss zwischen 1 und 100 liegen")
    if request_timeout <= 0:
        raise ValueError("request_timeout muss groesser als 0 sein")
    if delay_seconds < 0:
        raise ValueError("delay_seconds darf nicht negativ sein")


def _konfiguriere_http_session() -> Any:
    import requests

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (compatible; Stadt-Ludwigshafen-Dashboard-PoC/1.0)",
        "Referer": "https://ludwigshafen.maengelmelder.de/bms",
    })
    return session


def _lade_listenseite(session: Any, page: int, rows: int, request_timeout: float) -> str:
    response = session.post(
        URL,
        data={"address": "", "pageid": page, "rows": rows},
        timeout=request_timeout,
    )
    response.raise_for_status()
    if len(response.content) > MAX_HTML_BYTES:
        raise ValueError(f"HTTP-Antwort fuer Seite {page} ist groesser als {MAX_HTML_BYTES} Bytes")
    return response.text


def _schreibe_html_atomar(html: str, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(output_path.suffix + ".tmp")
    temporary_path.write_text(html, encoding="utf-8")
    temporary_path.replace(output_path)


def _lade_bestehenden_bestand(json_path: Path | None) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    if json_path is None or not json_path.exists():
        return None, []
    try:
        document = json.loads(json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Bestehende Gesamt-JSON ist nicht lesbar: {json_path}") from error

    records = document.get("maengel") if isinstance(document, dict) else None
    if not isinstance(records, list) or any(not isinstance(record, dict) for record in records):
        raise ValueError("Bestehende Gesamt-JSON enthaelt keine gueltige Liste 'maengel'")

    ids: set[str] = set()
    for record in records:
        message_id = record.get("id")
        if not isinstance(message_id, str) or not message_id.isdigit():
            raise ValueError("Bestehende Gesamt-JSON enthaelt eine ungueltige Meldungs-ID")
        if message_id in ids:
            raise ValueError(f"Bestehende Gesamt-JSON enthaelt die Meldungs-ID {message_id} mehrfach")
        ids.add(message_id)
    return document, records


def aktualisiere_maengelbestand(
    *,
    json_output_path: Path | None = DEFAULT_JSON_PATH,
    minimal_json_output_path: Path | None = DEFAULT_MINIMAL_JSON_PATH,
    html_output_directory: Path | None = DEFAULT_OUTPUT_DIRECTORY,
    max_pages: int = 5,
    rows: int = 100,
    request_timeout: float = 15.0,
    delay_seconds: float = 1.0,
) -> str:
    """Aktualisiert den Gesamtbestand inkrementell und gibt die fertige JSON zurueck.

    Der Abruf beginnt immer bei Seite 1. Neue Meldungen werden anhand ihrer ID
    vor den vorhandenen Bestand gesetzt. Sobald eine abgerufene Seite eine
    bereits bekannte ID enthaelt, wird diese Seite noch vollstaendig
    ausgewertet und danach nicht weiter gecrawlt. Ohne vorhandenen Bestand
    endet der Erstlauf spaetestens nach ``max_pages`` Seiten.

    ``json_output_path`` ist zugleich Eingabe und Ausgabe des Gesamtbestands.
    Mit ``None`` laeuft die Funktion ohne persistenten Gesamtbestand. HTML und
    Minimalstatistik koennen ebenfalls mit ``None`` deaktiviert werden.
    """

    _validiere_abrufparameter(max_pages, rows, request_timeout, delay_seconds)
    json_path = Path(json_output_path) if json_output_path is not None else None
    minimal_path = Path(minimal_json_output_path) if minimal_json_output_path is not None else None
    html_directory = Path(html_output_directory) if html_output_directory is not None else None
    existing_document, existing_records = _lade_bestehenden_bestand(json_path)

    records_by_id = {record["id"]: record for record in existing_records}
    known_ids = set(records_by_id)
    new_records: list[dict[str, Any]] = []
    pages: list[dict[str, Any]] = []
    duplicates: list[dict[str, Any]] = []
    conflicts: list[dict[str, Any]] = []
    reported_totals: set[int] = set()
    stop_reason = "max_pages_erreicht"

    session = _konfiguriere_http_session()
    try:
        for page_number in range(1, max_pages + 1):
            html = _lade_listenseite(session, page_number, rows, request_timeout)
            if not html.strip() or "message-short-tile" not in html:
                if page_number == 1:
                    raise ValueError("Die erste Listenseite enthaelt keine auswertbaren Meldungen")
                stop_reason = "keine_weitere_seite"
                break

            filename = f"seite_{page_number}.html"
            page = _analysiere_html_inhalt(html, dateiname=filename, seite=page_number)
            if not any(record["id"] is not None for record in page["maengel"]):
                raise ValueError(f"Listenseite {page_number} enthaelt keine gueltige Meldungs-ID")
            if html_directory is not None:
                _schreibe_html_atomar(html, html_directory / filename)
            pages.append(page)
            if page["gemeldete_gesamtzahl"] is not None:
                reported_totals.add(page["gemeldete_gesamtzahl"])

            page_has_duplicate = False
            for record in page["maengel"]:
                message_id = record["id"]
                if message_id is None:
                    continue
                if message_id in known_ids:
                    page_has_duplicate = True
                    existing = records_by_id[message_id]
                    occurrence = {
                        "id": message_id,
                        "behalten": existing.get("quelle"),
                        "doppelt": record["quelle"],
                    }
                    duplicates.append(occurrence)
                    comparable_existing = {key: value for key, value in existing.items() if key != "quelle"}
                    comparable_record = {key: value for key, value in record.items() if key != "quelle"}
                    if comparable_existing != comparable_record:
                        conflicts.append(occurrence)
                    continue
                known_ids.add(message_id)
                records_by_id[message_id] = record
                new_records.append(record)

            if page_has_duplicate:
                stop_reason = "bekannte_id_gefunden"
                break
            if page_number < max_pages and delay_seconds:
                time.sleep(delay_seconds)
    finally:
        session.close()

    records = new_records + existing_records
    reported_total = next(iter(reported_totals)) if len(reported_totals) == 1 else None
    page_errors = [
        {"datei": page["datei"], "seite": page["seite"], "meldungen": page["fehler"]}
        for page in pages
        if page["fehler"]
    ]
    now = datetime.now(timezone.utc).isoformat()
    result = {
        "schema_version": "1.1",
        "erstellt_am": now,
        "quelle": {
            "system": "Maengelmelder Ludwigshafen",
            "listen_endpunkt": URL,
            "eingabe_verzeichnis": str(html_directory) if html_directory is not None else None,
        },
        "aktualisierung": {
            "modus": "inkrementell" if existing_document is not None else "erstbestand",
            "abgerufen_am": now,
            "abgerufene_seiten": len(pages),
            "vorherige_maengel": len(existing_records),
            "neue_maengel": len(new_records),
            "bekannte_ids_im_abruf": len(duplicates),
            "abbruchgrund": stop_reason,
        },
        "abdeckung": {
            "analysierte_html_seiten": len(pages),
            "extrahierte_eintraege_vor_deduplizierung": sum(page["anzahl_maengel"] for page in pages),
            "eindeutige_maengel": len(records),
            "vom_portal_gemeldete_gesamtzahl": reported_total,
            "vollstaendig": reported_total is not None and len(records) == reported_total,
            "hinweis": "Inkrementeller Gesamtbestand; der Abruf endet bei der ersten Seite mit einer bekannten Meldungs-ID.",
        },
        "datenqualitaet": {
            "seiten_mit_feldfehlern": page_errors,
            "doppelte_ids": duplicates,
            "widerspruechliche_doppelte_ids": conflicts,
            "abweichende_portal_gesamtzahlen": sorted(reported_totals) if len(reported_totals) > 1 else [],
            "hinweis": "Beschreibungstexte koennen bereits in der HTML-Listenansicht gekuerzt sein; Bild-URLs werden nicht exportiert.",
        },
        "maengel": records,
    }

    result_json = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if json_path is not None:
        schreibe_json(result, json_path)
    if minimal_path is not None:
        schreibe_json(json.loads(erstelle_minimale_statistik_json(result)), minimal_path)
    return result_json


def crawl_seiten(output_directory: Path, start_page: int = 1, max_pages: int = 5, rows: int = 100) -> int:
    """Laedt Listenseiten ohne Zusammenfuehrung; fuer Offline-Diagnosen."""

    if start_page < 1:
        raise ValueError("start_page muss mindestens 1 sein")
    _validiere_abrufparameter(max_pages, rows, 15.0, 1.0)
    output_directory = Path(output_directory)
    session = _konfiguriere_http_session()
    saved = 0
    try:
        for page in range(start_page, start_page + max_pages):
            html = _lade_listenseite(session, page, rows, 15.0)
            if not html.strip() or "message-short-tile" not in html:
                break
            _schreibe_html_atomar(html, output_directory / f"seite_{page}.html")
            saved += 1
            if page < start_page + max_pages - 1:
                time.sleep(1.0)
    finally:
        session.close()
    return saved


def crawle_und_analysiere(
    output_directory: Path = DEFAULT_OUTPUT_DIRECTORY,
    *,
    start_page: int = 1,
    max_pages: int = 5,
    rows: int = 100,
    json_output_path: Path | None = DEFAULT_JSON_PATH,
) -> str:
    """Kompatibilitaetsalias fuer :func:`aktualisiere_maengelbestand`."""

    if start_page != 1:
        raise ValueError("Inkrementelle Aktualisierungen muessen bei Seite 1 beginnen")
    return aktualisiere_maengelbestand(
        json_output_path=json_output_path,
        minimal_json_output_path=None,
        html_output_directory=output_directory,
        max_pages=max_pages,
        rows=rows,
    )


def _build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Maengelmelder-Seiten laden oder lokal nach JSON analysieren")
    subparsers = parser.add_subparsers(dest="command")

    analyse_parser = subparsers.add_parser("analyse", help="Vorhandene HTML-Dateien zu JSON zusammenfassen")
    analyse_parser.add_argument("--input", type=Path, default=DEFAULT_OUTPUT_DIRECTORY)
    analyse_parser.add_argument("--output", type=Path, default=DEFAULT_JSON_PATH)
    analyse_parser.add_argument("--minimal-output", type=Path)

    crawl_parser = subparsers.add_parser("crawl", help="HTML-Seiten kontrolliert herunterladen")
    crawl_parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIRECTORY)
    crawl_parser.add_argument("--start-page", type=int, default=1)
    crawl_parser.add_argument("--max-pages", type=int, default=5)
    crawl_parser.add_argument("--rows", type=int, default=100)

    refresh_parser = subparsers.add_parser(
        "aktualisieren",
        aliases=["komplett"],
        help="Gesamtbestand ab Seite 1 inkrementell aktualisieren",
    )
    refresh_parser.add_argument("--html-output", type=Path, default=DEFAULT_OUTPUT_DIRECTORY)
    refresh_parser.add_argument("--json-output", type=Path, default=DEFAULT_JSON_PATH)
    refresh_parser.add_argument("--minimal-output", type=Path, default=DEFAULT_MINIMAL_JSON_PATH)
    refresh_parser.add_argument("--max-pages", type=int, default=5)
    refresh_parser.add_argument("--rows", type=int, default=100)
    refresh_parser.add_argument("--request-timeout", type=float, default=15.0)
    refresh_parser.add_argument("--delay-seconds", type=float, default=1.0)
    refresh_parser.add_argument("--ohne-html-cache", action="store_true")
    return parser


def main() -> None:
    parser = _build_argument_parser()
    args = parser.parse_args()
    command = args.command or "analyse"
    if command == "crawl":
        count = crawl_seiten(args.output, args.start_page, args.max_pages, args.rows)
        print(f"{count} Seite(n) gespeichert.")
        return

    if command in {"aktualisieren", "komplett"}:
        result_json = aktualisiere_maengelbestand(
            json_output_path=args.json_output,
            minimal_json_output_path=args.minimal_output,
            html_output_directory=None if args.ohne_html_cache else args.html_output,
            max_pages=args.max_pages,
            rows=args.rows,
            request_timeout=args.request_timeout,
            delay_seconds=args.delay_seconds,
        )
        result = json.loads(result_json)
        refresh = result["aktualisierung"]
        print(
            f"{refresh['neue_maengel']} neue, insgesamt {result['abdeckung']['eindeutige_maengel']} Maengel; "
            f"Abbruchgrund: {refresh['abbruchgrund']}."
        )
        return

    input_path = getattr(args, "input", DEFAULT_OUTPUT_DIRECTORY)
    output_path = getattr(args, "output", DEFAULT_JSON_PATH)
    result = fasse_html_seiten_zusammen(input_path)
    schreibe_json(result, output_path)
    minimal_output_path = getattr(args, "minimal_output", None)
    if minimal_output_path is not None:
        minimal_result = json.loads(erstelle_minimale_statistik_json(result))
        schreibe_json(minimal_result, minimal_output_path)
    print(f"{result['abdeckung']['eindeutige_maengel']} Maengel nach {output_path} geschrieben.")


if __name__ == "__main__":
    main()

