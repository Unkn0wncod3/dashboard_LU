(() => {
  "use strict";

  const DAY_MS = 86_400_000;
  const WEEKDAYS = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
  const $ = (selector) => document.querySelector(selector);
  const formatNumber = (value) => new Intl.NumberFormat("de-DE").format(value);
  const formatDate = (value) => new Date(`${value}T12:00:00`).toLocaleDateString("de-DE");
  const toIsoDate = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

  let rows = [];
  let page = 0;
  let trendModel = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function normalizeStatus(value) {
    const status = String(value || "").toLowerCase();
    if (/bearbeit|progress|läuft|pr[oü]fung/.test(status)) return "In Bearbeitung";
    if (/ungel[oö]st.*abgeschloss|abgeschloss|closed|abgelehnt|rejected|gel[oö]st|behoben|resolved|erledig/.test(status)) return "Gelöst";
    return "Offen";
  }

  function normalize(record) {
    const detailUrl = String(record.detail_url || "");
    return {
      id: String(record.id || "–"),
      title: String(record.beschreibung || "Meldung ohne Beschreibung"),
      location: String(record.ort || "–"),
      date: String(record.gemeldet_am || ""),
      category: String(record.kategorie || "Sonstiges"),
      status: normalizeStatus(record.status),
      detailUrl: /^https:\/\/ludwigshafen\.maengelmelder\.de\/bms\/\d+$/.test(detailUrl) ? detailUrl : "",
    };
  }

  function showError(message) {
    $("#categoryContent").classList.add("hidden");
    $("#categoryError").textContent = message;
    $("#categoryError").classList.remove("hidden");
  }

  function renderStats() {
    const resolved = rows.filter((row) => row.status === "Gelöst").length;
    const active = rows.filter((row) => ["Offen", "In Bearbeitung"].includes(row.status)).length;
    const dates = rows.map((row) => row.date).filter(Boolean).sort();
    const dayCount = dates.length ? Math.round((new Date(`${dates.at(-1)}T12:00:00`) - new Date(`${dates[0]}T12:00:00`)) / DAY_MS) + 1 : 0;
    let recent = 0;
    if (dates.length) {
      const start = new Date(`${dates.at(-1)}T12:00:00`);
      start.setDate(start.getDate() - 6);
      recent = rows.filter((row) => row.date >= toIsoDate(start) && row.date <= dates.at(-1)).length;
    }
    $("#categoryBadgeCount").textContent = formatNumber(rows.length);
    $("#categoryResolved").textContent = formatNumber(resolved);
    $("#categoryActive").textContent = formatNumber(active);
    $("#categoryResolvedRate").textContent = `${rows.length ? Math.round((resolved / rows.length) * 100) : 0} %`;
    $("#categoryDailyAverage").textContent = dayCount ? (rows.length / dayCount).toLocaleString("de-DE", { maximumFractionDigits: 1 }) : "0";
    $("#categoryRecent").textContent = formatNumber(recent);
  }

  function getTrendRows() {
    const dates = rows.map((row) => row.date).filter(Boolean).sort();
    const end = dates.at(-1) || toIsoDate(new Date());
    const period = $("#categoryPeriod").value;
    let start = "0000-01-01", rangeEnd = "9999-12-31";
    if (period === "custom") {
      start = $("#categoryFromDate").value || start;
      rangeEnd = $("#categoryToDate").value || rangeEnd;
    } else if (period !== "all") {
      const startDate = new Date(`${end}T12:00:00`);
      startDate.setDate(startDate.getDate() - (Number(period) - 1));
      start = toIsoDate(startDate);
      rangeEnd = end;
    }
    return rows.filter((row) => row.date >= start && row.date <= rangeEnd);
  }

  function startOfWeek(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return toIsoDate(date);
  }

  function buildTimeline(trendRows, mode) {
    if (!trendRows.length) return { keys: [], values: [] };
    const grouped = trendRows.reduce((result, row) => {
      const key = mode === "week" ? startOfWeek(row.date) : row.date;
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    const groupedKeys = Object.keys(grouped).sort();
    const keys = [];
    const cursor = new Date(`${groupedKeys[0]}T12:00:00`);
    const last = new Date(`${groupedKeys.at(-1)}T12:00:00`);
    while (cursor <= last && keys.length < 1000) {
      keys.push(toIsoDate(cursor));
      cursor.setDate(cursor.getDate() + (mode === "week" ? 7 : 1));
    }
    return { keys, values: keys.map((key) => grouped[key] || 0) };
  }

  function renderTrend() {
    const svg = $("#categoryTrend");
    const trendRows = getTrendRows();
    const mode = $("#categoryGranularity").value;
    const { keys, values } = buildTimeline(trendRows, mode);
    if (!values.length) {
      trendModel = null;
      svg.innerHTML = '<text x="350" y="120" text-anchor="middle" fill="#91a4af">Keine Meldungen im gewählten Zeitraum</text>';
      $("#categoryPeak").textContent = "Spitzentag: –";
      return;
    }
    const width = 700, height = 240, left = 42, right = 12, top = 16, bottom = 36;
    const chartWidth = width - left - right, chartHeight = height - top - bottom;
    const maximum = Math.max(5, Math.ceil(Math.max(...values) / 5) * 5);
    const x = (index) => left + (values.length === 1 ? chartWidth / 2 : (index / (values.length - 1)) * chartWidth);
    const y = (value) => top + chartHeight - (value / maximum) * chartHeight;
    let grid = "";
    for (let index = 0; index <= 4; index += 1) {
      const value = maximum * index / 4, yPosition = y(value);
      grid += `<line x1="${left}" y1="${yPosition}" x2="${width - right}" y2="${yPosition}" stroke="#e9eff2"/><text x="${left - 11}" y="${yPosition + 4}" text-anchor="end" font-size="11" fill="#99a9b1">${Math.round(value)}</text>`;
    }
    const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    const area = `${x(0)},${y(0)} ${points} ${x(values.length - 1)},${y(0)}`;
    const detailed = values.length <= 31;
    const labelEvery = Math.max(1, Math.ceil(values.length / (detailed ? 16 : 10)));
    const labels = keys.map((key, index) => {
      if (index % labelEvery !== 0 && index !== keys.length - 1) return "";
      const label = mode === "week" ? `ab ${formatDate(key).slice(0, 5)}` : `${WEEKDAYS[new Date(`${key}T12:00:00`).getDay()]} ${formatDate(key).slice(0, 5)}`;
      return `<text x="${x(index)}" y="${height - 9}" font-size="9" font-weight="700" text-anchor="middle" fill="#6f8794">${label}</text>`;
    }).join("");
    const separators = keys.map((key, index) => {
      if (!detailed && index % labelEvery !== 0 && index !== keys.length - 1) return "";
      return `<line x1="${x(index)}" y1="${top}" x2="${x(index)}" y2="${y(0)}" stroke="#b9c9d1" stroke-width="1" stroke-dasharray="3 5" opacity="${detailed ? ".62" : ".45"}"/>`;
    }).join("");
    const dots = detailed ? values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="4" fill="white" stroke="#397f9e" stroke-width="2"/>`).join("") : "";
    svg.innerHTML = `<defs><linearGradient id="categoryAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#5ca3bc" stop-opacity=".25"/><stop offset="1" stop-color="#5ca3bc" stop-opacity=".005"/></linearGradient></defs>${grid}${separators}<polygon points="${area}" fill="url(#categoryAreaGradient)"/><polyline class="trendLine" points="${points}" fill="none" stroke="#397f9e" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}<rect class="trendInteraction" x="${left}" y="${top}" width="${chartWidth}" height="${chartHeight}" fill="transparent"/><g id="categoryTrendHover" hidden pointer-events="none"><line id="categoryTrendHoverLine" y1="${top}" y2="${y(0)}" stroke="#1d5f7b" stroke-width="1" stroke-dasharray="2 3"/><circle id="categoryTrendHoverDot" r="5" fill="#fff" stroke="#1d5f7b" stroke-width="2.5"/><rect id="categoryTrendHoverBox" width="190" height="26" rx="5" fill="#244f64"/><text id="categoryTrendHoverText" class="trendHoverText" dominant-baseline="middle"></text></g>`;
    trendModel = { keys, values, mode, width, left, right, top, chartWidth, x, y };
    const dailyCounts = trendRows.reduce((result, row) => {
      result[row.date] = (result[row.date] || 0) + 1;
      return result;
    }, {});
    const peak = Object.entries(dailyCounts).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0];
    $("#categoryPeak").textContent = peak ? `Spitzentag: ${formatDate(peak[0])} · ${peak[1]}` : "Spitzentag: –";
  }

  function showTrendHover(event) {
    if (!trendModel) return;
    const svg = $("#categoryTrend"), matrix = svg.getScreenCTM();
    if (!matrix) return;
    const svgX = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).x;
    const ratio = Math.max(0, Math.min(1, (svgX - trendModel.left) / trendModel.chartWidth));
    const index = Math.round(ratio * Math.max(0, trendModel.values.length - 1));
    const pointX = trendModel.x(index), pointY = trendModel.y(trendModel.values[index]);
    const boxWidth = 190;
    const boxX = pointX + boxWidth + 10 > trendModel.width - trendModel.right ? pointX - boxWidth - 10 : pointX + 10;
    const boxY = Math.max(trendModel.top, pointY - 34);
    const group = $("#categoryTrendHover");
    if (!group) return;
    group.removeAttribute("hidden");
    $("#categoryTrendHoverLine").setAttribute("x1", pointX);
    $("#categoryTrendHoverLine").setAttribute("x2", pointX);
    $("#categoryTrendHoverDot").setAttribute("cx", pointX);
    $("#categoryTrendHoverDot").setAttribute("cy", pointY);
    $("#categoryTrendHoverBox").setAttribute("x", boxX);
    $("#categoryTrendHoverBox").setAttribute("y", boxY);
    const text = $("#categoryTrendHoverText");
    text.setAttribute("x", boxX + 9);
    text.setAttribute("y", boxY + 13);
    text.textContent = `${trendModel.mode === "week" ? "Woche ab " : ""}${formatDate(trendModel.keys[index])}: ${trendModel.values[index]} Meldungen`;
  }

  function hideTrendHover() {
    const group = $("#categoryTrendHover");
    if (group) group.setAttribute("hidden", "");
  }

  function filteredRows() {
    const query = $("#categorySearch").value.toLocaleLowerCase("de").trim();
    const status = $("#categoryStatus").value;
    return rows.filter((row) => (status === "all" || row.status === status)
      && (!query || [row.id, row.title, row.location, row.status, row.date].some((value) => String(value).toLocaleLowerCase("de").includes(query))))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }

  function renderReports() {
    const list = filteredRows();
    const pageSize = Number($("#categoryPageSize").value) || 25;
    const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
    page = Math.min(page, pageCount - 1);
    const start = page * pageSize;
    const current = list.slice(start, start + pageSize);
    $("#categoryReports").innerHTML = current.length ? current.map((row) => {
      const statusClass = ({ "Gelöst": "geloest", "In Bearbeitung": "bearbeitung", "Offen": "offen" })[row.status] || "offen";
      const content = `<span><span class="reportCardTitle">${escapeHtml(row.title)}</span><span class="reportCardMeta"><span>#${escapeHtml(row.id)}</span><span>${formatDate(row.date)}</span><span class="status ${statusClass}">${escapeHtml(row.status)}</span></span></span><span class="reportCardLocation">${escapeHtml(row.location)}</span><span class="reportCardAction">Original öffnen ↗</span>`;
      return row.detailUrl ? `<a class="reportCard" href="${escapeHtml(row.detailUrl)}" target="_blank" rel="noopener">${content}</a>` : `<div class="reportCard">${content}</div>`;
    }).join("") : '<div class="empty">Keine passenden Meldungen gefunden.</div>';
    $("#categoryCountLabel").textContent = `${formatNumber(list.length)} Meldungen · ${list.length ? `${formatNumber(start + 1)}–${formatNumber(Math.min(start + pageSize, list.length))}` : "0"} angezeigt`;
    $("#categoryPageLabel").textContent = `${page + 1} / ${pageCount}`;
    $("#categoryPrev").disabled = page <= 0;
    $("#categoryNext").disabled = page >= pageCount - 1;
  }

  async function load() {
    const category = new URLSearchParams(window.location.search).get("category");
    if (!category) {
      showError("Keine Kategorie angegeben. Bitte über die Übersicht eine Kategorie auswählen.");
      return;
    }
    try {
      const response = await fetch("/api/maengel", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const document = await response.json();
      if (!Array.isArray(document.maengel)) throw new Error("Gesamtauswertung hat ein unerwartetes Format.");
      rows = document.maengel.map(normalize).filter((row) => row.category === category && row.date);
      if (!rows.length) throw new Error("Für diese Kategorie sind keine lokalen Meldungen vorhanden.");
      document.title = `${category} – Mängelmelder Ludwigshafen`;
      $("#categoryTitle").textContent = category;
      renderStats();
      renderTrend();
      renderReports();
    } catch (error) {
      showError(`Kategorie konnte nicht geladen werden: ${error.message}`);
    }
  }

  ["categoryStatus", "categoryPageSize"].forEach((id) => $("#" + id).addEventListener("change", () => { page = 0; renderReports(); }));
  ["categoryPeriod", "categoryGranularity", "categoryFromDate", "categoryToDate"].forEach((id) => $("#" + id).addEventListener("change", () => {
    $("#categoryCustomRange").classList.toggle("hidden", $("#categoryPeriod").value !== "custom");
    renderTrend();
  }));
  $("#categoryTrend").addEventListener("pointermove", showTrendHover);
  $("#categoryTrend").addEventListener("pointerleave", hideTrendHover);
  $("#categorySearch").addEventListener("input", () => { page = 0; renderReports(); });
  $("#categoryPrev").addEventListener("click", () => { page -= 1; renderReports(); });
  $("#categoryNext").addEventListener("click", () => { page += 1; renderReports(); });
  load();
})();
