(() => {
  "use strict";

  const grid = document.querySelector("#overviewGrid");
  const moreButton = document.querySelector("#showMoreMetrics");
  const lessButton = document.querySelector("#showLessMetrics");
  const formatNumber = (value) => new Intl.NumberFormat("de-DE").format(value);
  const formatDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("de-DE") : "–";
  let metrics = [];
  let visibleCount = 8;

  function normalizeStatus(value) {
    const status = String(value || "").toLowerCase();
    if (/bearbeit|progress|läuft|pr[oü]fung/.test(status)) return "In Bearbeitung";
    if (/ungel[oö]st.*abgeschloss|abgeschloss|closed|abgelehnt|rejected/.test(status)) return "Abgeschlossen";
    if (/gel[oö]st|behoben|resolved|erledig/.test(status)) return "Gelöst";
    return "Offen";
  }

  function render() {
    const shown = metrics.slice(0, visibleCount);
    grid.className = `overviewGrid density${shown.length <= 4 ? 4 : shown.length <= 8 ? 8 : 12}`;
    grid.innerHTML = shown.map((metric, index) => `<article class="overviewMetric" style="--metric-index:${index}"><span>${metric.label}</span><strong>${metric.value}</strong><small>${metric.note}</small></article>`).join("");
    moreButton.disabled = visibleCount >= metrics.length;
    lessButton.disabled = visibleCount <= Math.min(4, metrics.length);
    moreButton.textContent = moreButton.disabled ? "Alle Daten sichtbar" : "Mehr Daten anzeigen";
  }

  async function load() {
    try {
      const responses = await Promise.all([
        fetch("/api/maengel", { cache: "no-store" }),
        fetch("/api/statistik", { cache: "no-store" }),
      ]);
      for (const response of responses) if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const [analysis, summary] = await Promise.all(responses.map((response) => response.json()));
      if (!Array.isArray(analysis.maengel) || typeof summary.anzahl_maengel !== "number") throw new Error("Unerwartetes Datenformat");
      const rows = analysis.maengel.map((row) => ({
        date: String(row.gemeldet_am || ""),
        category: String(row.kategorie || "Sonstiges"),
        status: normalizeStatus(row.status),
      })).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date));
      const statuses = rows.reduce((result, row) => {
        result[row.status] = (result[row.status] || 0) + 1;
        return result;
      }, {});
      const categories = rows.reduce((result, row) => {
        result[row.category] = (result[row.category] || 0) + 1;
        return result;
      }, {});
      const dates = rows.map((row) => row.date).sort();
      const newest = dates.at(-1) || "";
      const oldest = dates[0] || "";
      const dayCount = dates.length ? Math.round((new Date(`${newest}T12:00:00`) - new Date(`${oldest}T12:00:00`)) / 86_400_000) + 1 : 0;
      const recentStart = newest ? new Date(`${newest}T12:00:00`) : null;
      if (recentStart) recentStart.setDate(recentStart.getDate() - 6);
      const recentIso = recentStart ? [recentStart.getFullYear(), String(recentStart.getMonth() + 1).padStart(2, "0"), String(recentStart.getDate()).padStart(2, "0")].join("-") : "";
      const recent = newest ? rows.filter((row) => row.date >= recentIso && row.date <= newest).length : 0;
      const resolved = statuses["Gelöst"] || 0;
      const active = (statuses["Offen"] || 0) + (statuses["In Bearbeitung"] || 0);
      const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "de"))[0] || ["–", 0];
      const complete = Boolean(analysis.abdeckung?.vollstaendig || summary.vollstaendig);
      metrics = [
        { label: "Meldungen insgesamt", value: formatNumber(rows.length), note: complete ? "Portalbestand vollständig" : "lokal ausgewerteter Teilbestand" },
        { label: "Gelöst", value: formatNumber(resolved), note: `${rows.length ? Math.round((resolved / rows.length) * 100) : 0} % Lösungsquote` },
        { label: "Aktiver Bestand", value: formatNumber(active), note: "offen oder in Bearbeitung" },
        { label: "Letzte 7 Tage", value: formatNumber(recent), note: newest ? `bis ${formatDate(newest)}` : "kein Datenstand" },
        { label: "Größte Kategorie", value: topCategory[0], note: `${formatNumber(topCategory[1])} Meldungen` },
        { label: "Kategorien", value: formatNumber(Object.keys(categories).length), note: "im lokalen Datenbestand" },
        { label: "Pro Kalendertag", value: dayCount ? (rows.length / dayCount).toLocaleString("de-DE", { maximumFractionDigits: 1 }) : "0", note: dayCount ? `über ${formatNumber(dayCount)} Tage` : "keine Daten" },
        { label: "Datenstand", value: formatDate(newest), note: "neuester Meldungseingang" },
        { label: "In Bearbeitung", value: formatNumber(statuses["In Bearbeitung"] || 0), note: "aktueller Status" },
        { label: "Offen", value: formatNumber(statuses.Offen || 0), note: "aktueller Status" },
        { label: "Abgeschlossen", value: formatNumber(statuses.Abgeschlossen || 0), note: "nicht als gelöst gewertet" },
        { label: "Minimalstatistik", value: formatNumber(summary.anzahl_maengel), note: summary.anzahl_maengel === rows.length ? "konsistent mit Gesamtauswertung" : "abweichender Datenstand" },
      ];
      document.querySelector("#sourceState").textContent = "Quelle verfügbar";
      document.querySelector("#sourceStrip").classList.add("isAvailable");
      document.querySelector("#overviewFreshness").textContent = newest ? `Quelldaten bis ${formatDate(newest)}` : "Datenstand unbekannt";
      render();
    } catch (error) {
      document.querySelector("#sourceState").textContent = `Quelle nicht verfügbar: ${error.message}`;
      document.querySelector("#sourceStrip").classList.add("hasError");
      document.querySelector("#overviewFreshness").textContent = "Keine aktuellen Daten";
      grid.innerHTML = '<div class="overviewError">Die Gesamtübersicht konnte nicht geladen werden.</div>';
      moreButton.disabled = true;
      lessButton.disabled = true;
    }
  }

  moreButton.addEventListener("click", () => {
    visibleCount = Math.min(metrics.length, visibleCount + 4);
    render();
  });
  lessButton.addEventListener("click", () => {
    visibleCount = Math.max(Math.min(4, metrics.length), visibleCount - 4);
    render();
  });
  load();
})();
