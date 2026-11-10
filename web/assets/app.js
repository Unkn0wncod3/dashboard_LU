(() => {
  "use strict";

  const FULL_DATA_URL = "/api/maengel";
  const SUMMARY_URL = "/api/statistik";
  const REFRESH_URL = "/api/aktualisieren";
  const REFRESH_STATUS_URL = "/api/aktualisierungsstatus";
  const STATUS_ORDER = ["Gelöst", "In Bearbeitung", "Offen", "Abgeschlossen"];
  const STATUS_COLORS = { "Gelöst": "#348b70", "In Bearbeitung": "#dfae61", "Offen": "#cd7567", "Abgeschlossen": "#95a5b1" };
  const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const DAY_MS = 86_400_000;
  const $ = (selector) => document.querySelector(selector);
  const formatNumber = (value) => new Intl.NumberFormat("de-DE").format(value);
  const formatDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("de-DE") : "–";
  const toIsoDate = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

  let data = [];
  let currentPage = 0;
  let trendModel = null;
  let refreshPollAttempts = 0;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.remove("hidden");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.add("hidden"), 4000);
  }

  function groupBy(rows, keyFunction) {
    return rows.reduce((groups, row) => {
      const key = keyFunction(row);
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {});
  }

  function normalizeDate(value) {
    if (!value) return "";
    let match = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    match = String(value).match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "" : toIsoDate(parsed);
  }

  function normalizeStatus(value) {
    const status = String(value || "").toLowerCase();
    if (/bearbeit|progress|läuft|pr[oü]fung/.test(status)) return "In Bearbeitung";
    if (/ungel[oö]st.*abgeschloss|abgeschloss|closed|abgelehnt|rejected/.test(status)) return "Abgeschlossen";
    if (/gel[oö]st|behoben|resolved|erledig/.test(status)) return "Gelöst";
    return "Offen";
  }

  function pick(record, names) {
    const normalizedKeys = Object.fromEntries(Object.keys(record).map((key) => [key.toLowerCase().replace(/[^a-zäöü0-9]/gi, ""), record[key]]));
    for (const name of names) {
      const key = name.toLowerCase().replace(/[^a-zäöü0-9]/gi, "");
      if (normalizedKeys[key] != null && String(normalizedKeys[key]).trim() !== "") return String(normalizedKeys[key]).trim();
    }
    return "";
  }

  function normalizeRecord(record, index) {
    const date = normalizeDate(pick(record, ["datum", "date", "created_at", "createdat", "creationdate", "created", "gemeldet_am", "gemeldetam", "meldedatum", "erstelltdatum", "erstelltam", "eingang", "timestamp"]));
    if (!date) return null;
    const detailUrl = pick(record, ["detail_url", "detailurl", "url"]);
    return {
      id: pick(record, ["id", "nummer", "nr", "number", "ticket", "meldungid", "meldeid"]) || String(index + 1),
      title: pick(record, ["titel", "title", "beschreibung", "description", "subject", "name", "text"]) || "Meldung ohne Titel",
      category: pick(record, ["kategorie", "category", "type", "typ", "thema", "bereich"]) || "Sonstiges",
      location: pick(record, ["ort", "location", "adresse", "address"]) || "–",
      date,
      status: normalizeStatus(pick(record, ["status", "state", "zustand", "bearbeitungsstatus"])),
      detailUrl: /^https:\/\/ludwigshafen\.maengelmelder\.de\/bms\/\d+$/.test(detailUrl) ? detailUrl : "",
    };
  }

  function getDateWindow() {
    const dates = data.map((row) => row.date).filter(Boolean).sort();
    const end = dates.at(-1) || toIsoDate(new Date());
    const period = $("#period").value;
    if (period === "custom") return { start: $("#fromDate").value || "0000-01-01", end: $("#toDate").value || "9999-12-31" };
    if (period === "all") return { start: "0000-01-01", end: "9999-12-31" };
    const startDate = new Date(`${end}T12:00:00`);
    startDate.setDate(startDate.getDate() - (Number(period) - 1));
    return { start: toIsoDate(startDate), end };
  }

  function filteredRows() {
    const { start, end } = getDateWindow();
    return data.filter((row) => row.date >= start && row.date <= end);
  }

  function inclusiveDayCount(rows) {
    const dates = rows.map((row) => row.date).sort();
    if (!dates.length) return 0;
    return Math.round((new Date(`${dates.at(-1)}T12:00:00`) - new Date(`${dates[0]}T12:00:00`)) / DAY_MS) + 1;
  }

  function renderStats(rows) {
    const statuses = groupBy(rows, (row) => row.status);
    const resolved = statuses["Gelöst"] || 0;
    const active = (statuses["Offen"] || 0) + (statuses["In Bearbeitung"] || 0);
    const dayCount = inclusiveDayCount(rows);
    const newestDate = rows.map((row) => row.date).sort().at(-1);
    let recentCount = 0;
    if (newestDate) {
      const recentStart = new Date(`${newestDate}T12:00:00`);
      recentStart.setDate(recentStart.getDate() - 6);
      recentCount = rows.filter((row) => row.date >= toIsoDate(recentStart) && row.date <= newestDate).length;
    }
    $("#total").textContent = formatNumber(rows.length);
    $("#resolved").textContent = formatNumber(resolved);
    $("#resolvedNote").innerHTML = `<b>${rows.length ? Math.round((resolved / rows.length) * 100) : 0} %</b> im gewählten Zeitraum`;
    $("#open").textContent = formatNumber(active);
    $("#dailyAverage").textContent = dayCount ? (rows.length / dayCount).toLocaleString("de-DE", { maximumFractionDigits: 1 }) : "0";
    $("#dailyAverageNote").textContent = dayCount ? `Durchschnitt über ${dayCount} Kalendertage` : "Keine Daten im Zeitraum";
    $("#lastSevenDays").textContent = formatNumber(recentCount);
    $("#lastSevenNote").textContent = newestDate ? `Datenstand bis ${formatDate(newestDate)}` : "Kein Datenstand verfügbar";
  }

  function startOfWeek(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    return toIsoDate(date);
  }

  function buildTimeline(rows, mode) {
    if (!rows.length) return { keys: [], values: [] };
    const grouped = groupBy(rows, (row) => mode === "week" ? startOfWeek(row.date) : row.date);
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

  function renderTrend(rows) {
    const svg = $("#trend");
    const mode = $("#granularity").value;
    const { keys, values } = buildTimeline(rows, mode);
    if (!values.length) {
      trendModel = null;
      svg.innerHTML = '<text x="350" y="120" text-anchor="middle" fill="#91a4af">Keine Meldungen im gewählten Zeitraum</text>';
      $("#trendTag").textContent = mode === "week" ? "Wöchentlich" : "Täglich";
      $("#peakDay").textContent = "Spitzentag: –";
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
    const weekdayNames = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"];
    const detailed = values.length <= 31;
    const labelEvery = Math.max(1, Math.ceil(values.length / (detailed ? 16 : 10)));
    const labels = keys.map((key, index) => {
      if (index % labelEvery !== 0 && index !== keys.length - 1) return "";
      const weekday = weekdayNames[new Date(`${key}T12:00:00`).getDay()];
      const label = mode === "week" ? `ab ${formatDate(key).slice(0, 5)}` : `${weekday} ${formatDate(key).slice(0, 5)}`;
      return `<text x="${x(index)}" y="${height - 9}" font-size="9" font-weight="700" text-anchor="middle" fill="#6f8794">${label}</text>`;
    }).join("");
    const separators = keys.map((key, index) => {
      if (!detailed && index % labelEvery !== 0 && index !== keys.length - 1) return "";
      return `<line x1="${x(index)}" y1="${top}" x2="${x(index)}" y2="${y(0)}" stroke="#b9c9d1" stroke-width="1" stroke-dasharray="3 5" opacity="${detailed ? ".62" : ".45"}"/>`;
    }).join("");
    const dots = detailed ? values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="4" fill="white" stroke="#397f9e" stroke-width="2"/>`).join("") : "";
    svg.innerHTML = `<defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#5ca3bc" stop-opacity=".25"/><stop offset="1" stop-color="#5ca3bc" stop-opacity=".005"/></linearGradient></defs>${grid}${separators}<polygon points="${area}" fill="url(#areaGradient)"/><polyline class="trendLine" points="${points}" fill="none" stroke="#397f9e" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>${dots}${labels}<rect class="trendInteraction" x="${left}" y="${top}" width="${chartWidth}" height="${chartHeight}" fill="transparent"/><g id="trendHover" hidden pointer-events="none"><line id="trendHoverLine" y1="${top}" y2="${y(0)}" stroke="#1d5f7b" stroke-width="1" stroke-dasharray="2 3"/><circle id="trendHoverDot" r="5" fill="#fff" stroke="#1d5f7b" stroke-width="2.5"/><rect id="trendHoverBox" width="190" height="26" rx="5" fill="#244f64"/><text id="trendHoverText" class="trendHoverText" dominant-baseline="middle"></text></g>`;
    trendModel = { keys, values, mode, width, left, right, top, chartWidth, chartHeight, x, y };
    $("#trendTag").textContent = `${mode === "week" ? "Wöchentlich" : "Täglich"} · ${keys.length} Werte${detailed ? " · Punkte" : " · Linie"}`;
    const dailyCounts = groupBy(rows, (row) => row.date);
    const peak = Object.entries(dailyCounts).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0];
    $("#peakDay").textContent = peak ? `Spitzentag: ${formatDate(peak[0])} · ${peak[1]}` : "Spitzentag: –";
  }

  function showTrendHover(event) {
    if (!trendModel) return;
    const svg = $("#trend"), matrix = svg.getScreenCTM();
    if (!matrix) return;
    const svgX = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).x;
    const ratio = Math.max(0, Math.min(1, (svgX - trendModel.left) / trendModel.chartWidth));
    const index = Math.round(ratio * Math.max(0, trendModel.values.length - 1));
    const pointX = trendModel.x(index), pointY = trendModel.y(trendModel.values[index]);
    const boxWidth = 190;
    const boxX = pointX + boxWidth + 10 > trendModel.width - trendModel.right ? pointX - boxWidth - 10 : pointX + 10;
    const boxY = Math.max(trendModel.top, pointY - 34);
    const group = $("#trendHover");
    if (!group) return;
    group.removeAttribute("hidden");
    $("#trendHoverLine").setAttribute("x1", pointX);
    $("#trendHoverLine").setAttribute("x2", pointX);
    $("#trendHoverDot").setAttribute("cx", pointX);
    $("#trendHoverDot").setAttribute("cy", pointY);
    $("#trendHoverBox").setAttribute("x", boxX);
    $("#trendHoverBox").setAttribute("y", boxY);
    const text = $("#trendHoverText");
    text.setAttribute("x", boxX + 9);
    text.setAttribute("y", boxY + 13);
    text.textContent = `${trendModel.mode === "week" ? "Woche ab " : ""}${formatDate(trendModel.keys[index])}: ${trendModel.values[index]} Meldungen`;
  }

  function hideTrendHover() {
    const group = $("#trendHover");
    if (group) group.setAttribute("hidden", "");
  }

  function renderStatus(rows) {
    const counts = groupBy(rows, (row) => row.status), total = rows.length;
    $("#donutNum").textContent = formatNumber(total);
    let angle = 0;
    const stops = STATUS_ORDER.map((status) => {
      const next = angle + (total ? ((counts[status] || 0) / total) * 360 : 0);
      const stop = `${STATUS_COLORS[status]} ${angle}deg ${next}deg`;
      angle = next;
      return stop;
    });
    $("#donut").style.background = total ? `conic-gradient(${stops.join(",")})` : "#e6eef2";
    $("#statusLegend").innerHTML = STATUS_ORDER.map((status) => `<div class="legendrow"><span class="swatch" style="background:${STATUS_COLORS[status]}"></span><span class="leglabel">${status}</span><strong>${formatNumber(counts[status] || 0)}</strong></div>`).join("");
  }

  function renderDepartments(rows) {
    const departments = [...new Set(rows.map((row) => row.category))].map((category) => {
      const ownRows = rows.filter((row) => row.category === category);
      const solved = ownRows.filter((row) => row.status === "Gelöst").length;
      const active = ownRows.filter((row) => ["Offen", "In Bearbeitung"].includes(row.status)).length;
      return { category, total: ownRows.length, active, share: rows.length ? Math.round((ownRows.length / rows.length) * 100) : 0, solvedRate: ownRows.length ? Math.round((solved / ownRows.length) * 100) : 0 };
    }).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, "de"));
    $("#departmentGrid").innerHTML = departments.length ? departments.map((department, index) => `<a class="departmentCard" href="/category.html?category=${encodeURIComponent(department.category)}"><span class="departmentRank">${String(index + 1).padStart(2, "0")}</span><span class="departmentName">${escapeHtml(department.category)}</span><span class="departmentTotal">${formatNumber(department.total)}</span><span class="departmentLabel">Meldungen · ${department.share} % Anteil</span><span class="departmentMetrics"><span><b>${formatNumber(department.active)}</b> aktiv</span><span><b>${department.solvedRate} %</b> gelöst</span></span><span class="departmentProgress"><i style="width:${department.solvedRate}%"></i></span></a>`).join("") : '<div class="empty departmentEmpty">Keine Kategorien im gewählten Zeitraum.</div>';
  }

  function renderCategoryBars(rows) {
    const categories = Object.entries(groupBy(rows, (row) => row.category)).sort((a, b) => b[1] - a[1]).slice(0, 7);
    const maximum = Math.max(1, ...categories.map((entry) => entry[1]));
    $("#categoryBars").innerHTML = categories.length ? categories.map(([category, count]) => `<div class="catrow" title="${escapeHtml(category)}"><span class="name">${escapeHtml(category)}</span><div class="track"><div class="fill" style="width:${(count / maximum) * 100}%"></div></div><span class="count">${formatNumber(count)}</span></div>`).join("") : '<div class="empty">Keine Kategorien vorhanden</div>';
  }

  function renderWeekdays(rows) {
    const counts = [0, 0, 0, 0, 0, 0, 0];
    rows.forEach((row) => { const weekday = new Date(`${row.date}T12:00:00`).getDay(); if (!Number.isNaN(weekday)) counts[(weekday + 6) % 7] += 1; });
    const maximum = Math.max(1, ...counts);
    $("#weekdayBars").innerHTML = counts.map((count, index) => `<div class="weekdayitem" title="${WEEKDAY_LABELS[index]}: ${count} Meldungen"><div class="bubble">${count}</div><div class="bar ${count === maximum ? "high" : ""}" style="height:${Math.max(2, (count / maximum) * 123)}px"></div><span>${WEEKDAY_LABELS[index]}</span></div>`).join("");
  }

  function renderReports(rows) {
    const query = $("#search").value.toLocaleLowerCase("de").trim();
    const selectedStatus = $("#tableStatus").value;
    const pageSize = Number($("#pageSize").value) || 15;
    const list = rows.filter((row) => (selectedStatus === "all" || row.status === selectedStatus)
      && (!query || [row.id, row.title, row.category, row.location, row.status, row.date].some((value) => String(value).toLocaleLowerCase("de").includes(query))))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
    currentPage = Math.min(currentPage, pageCount - 1);
    const firstIndex = currentPage * pageSize;
    const subset = list.slice(firstIndex, firstIndex + pageSize);
    $("#mainReports").innerHTML = subset.length ? subset.map((row) => {
      const statusClass = ({ "Gelöst": "geloest", "In Bearbeitung": "bearbeitung", "Offen": "offen", "Abgeschlossen": "abgeschlossen" })[row.status] || "abgeschlossen";
      const content = `<span><span class="reportCardTitle">${escapeHtml(row.title)}</span><span class="reportCardMeta"><span>#${escapeHtml(row.id)}</span><span>${formatDate(row.date)}</span><span class="reportCardCategory">${escapeHtml(row.category)}</span><span class="status ${statusClass}">${escapeHtml(row.status)}</span></span></span><span class="reportCardLocation">${escapeHtml(row.location)}</span><span class="reportCardAction">${row.detailUrl ? "Original öffnen ↗" : "Kein Link verfügbar"}</span>`;
      return row.detailUrl ? `<a class="reportCard" href="${escapeHtml(row.detailUrl)}" target="_blank" rel="noopener">${content}</a>` : `<div class="reportCard">${content}</div>`;
    }).join("") : '<div class="empty">Keine passenden Meldungen gefunden.</div>';
    $("#countLabel").textContent = `${formatNumber(list.length)} Meldungen · ${list.length ? `${formatNumber(firstIndex + 1)}–${formatNumber(Math.min(firstIndex + pageSize, list.length))}` : "0"} angezeigt`;
    $("#pageLabel").textContent = `${currentPage + 1} / ${pageCount}`;
    $("#prev").disabled = currentPage <= 0;
    $("#next").disabled = currentPage >= pageCount - 1;
  }

  function render() {
    const rows = filteredRows();
    renderStats(rows);
    renderTrend(rows);
    renderStatus(rows);
    renderDepartments(rows);
    renderCategoryBars(rows);
    renderWeekdays(rows);
    renderReports(rows);
  }

  async function loadServerData() {
    try {
      const responses = await Promise.all([fetch(FULL_DATA_URL, { cache: "no-store" }), fetch(SUMMARY_URL, { cache: "no-store" })]);
      for (const response of responses) if (!response.ok) throw new Error(`${response.url}: HTTP ${response.status}`);
      const [analysis, summary] = await Promise.all(responses.map((response) => response.json()));
      if (!Array.isArray(analysis.maengel)) throw new Error("Gesamtauswertung enthält kein Array 'maengel'.");
      if (!summary || typeof summary.anzahl_maengel !== "number") throw new Error("Minimalstatistik hat ein unerwartetes Format.");
      const normalized = analysis.maengel.map(normalizeRecord).filter(Boolean);
      if (!normalized.length) throw new Error("Keine Meldungen mit gültigem Datum gefunden.");
      data = normalized;
      currentPage = 0;
      $("#dataBadge").textContent = "LOKALE SERVERDATEN";
      $("#dataBadge").style.cssText = "color:#33785e;background:#e7f5ee;border-color:#cde8d9";
      $("#dataNotice").innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/></svg><span><strong>Lokale Serverdaten geladen.</strong> Gesamt- und Minimalstatistik wurden erfolgreich eingelesen.</span>';
      const coverage = analysis.abdeckung?.vollstaendig ? "Portalbestand vollständig" : "lokaler Teilbestand";
      if (summary.anzahl_maengel !== normalized.length) {
        $("#dataNotice").innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg><span><strong>Datenstände weichen voneinander ab.</strong> Gesamtauswertung: ${formatNumber(normalized.length)} · Minimalstatistik: ${formatNumber(summary.anzahl_maengel)} · ${coverage}.</span>`;
      }
      render();
      toast(`${normalized.length} Meldungen aus beiden JSON-Endpunkten geladen.`);
      return true;
    } catch (error) {
      data = [];
      $("#dataBadge").textContent = "DATENFEHLER";
      $("#dataBadge").style.cssText = "color:#a14d43;background:#faece9;border-color:#efcfc9";
      $("#dataNotice").innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg><span><strong>Lokale Serverdaten konnten nicht geladen werden.</strong> Server und JSON-Dateien prüfen.</span>';
      render();
      toast(`Datenladen fehlgeschlagen: ${error.message}`);
      return false;
    }
  }

  function setRefreshButton(running, label = "Neue Meldungen abrufen") {
    const button = $("#refreshData");
    button.disabled = running;
    button.classList.toggle("isRunning", running);
    button.textContent = label;
  }

  function setRefreshFeedback(state, message) {
    const status = $("#refreshStatus");
    status.dataset.state = state;
    status.textContent = message;
  }

  function refreshErrorMessage(error) {
    if (error instanceof TypeError) {
      return "Keine Antwort vom Server. Prüfen, ob dashboard_server.py auf Port 8000 läuft.";
    }
    return error.message;
  }

  async function pollRefreshStatus() {
    refreshPollAttempts += 1;
    try {
      const response = await fetch(REFRESH_STATUS_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const status = await response.json();
      if (status.status === "laeuft") {
        if (refreshPollAttempts >= 180) throw new Error("Zeitüberschreitung bei der Aktualisierung");
        setRefreshButton(true, "Daten werden abgerufen …");
        setRefreshFeedback("running", `Crawler läuft · Statusprüfung ${refreshPollAttempts} · bitte warten …`);
        setTimeout(pollRefreshStatus, 1000);
        return;
      }
      if (status.status === "erfolgreich") {
        setRefreshButton(true, "Daten werden neu geladen …");
        setRefreshFeedback("running", "Crawler abgeschlossen · aktualisierte JSON-Daten werden eingelesen …");
        const loaded = await loadServerData();
        if (!loaded) throw new Error("Crawler war erfolgreich, aber die aktualisierten JSON-Daten konnten nicht geladen werden");
        const message = `${status.neue_maengel || 0} neue Meldungen · ${status.gesamt || data.length} insgesamt · ${status.abgerufene_seiten || 0} Seite(n) geprüft.`;
        setRefreshButton(false);
        setRefreshFeedback("success", `Aktualisierung erfolgreich: ${message}`);
        toast(message);
        return;
      }
      if (status.status === "fehler") throw new Error(status.meldung || "Aktualisierung fehlgeschlagen");
      setRefreshButton(false);
      setRefreshFeedback("ready", "Aktualisierung bereit.");
    } catch (error) {
      setRefreshButton(false);
      const message = refreshErrorMessage(error);
      setRefreshFeedback("error", `Aktualisierung fehlgeschlagen: ${message}`);
      toast(`Aktualisierung fehlgeschlagen: ${message}`);
    }
  }

  async function startRefresh() {
    setRefreshButton(true, "Aktualisierung startet …");
    setRefreshFeedback("starting", "Anfrage wird an den Dashboard-Server gesendet …");
    refreshPollAttempts = 0;
    try {
      const response = await fetch(REFRESH_URL, {
        method: "POST",
        headers: { "X-Dashboard-Request": "1" },
        cache: "no-store",
      });
      if (response.status === 404) {
        throw new Error("Refresh-API nicht verfügbar. Bitte dashboard_server.py neu starten und keinen reinen Static-/Live-Server verwenden.");
      }
      if (![202, 409].includes(response.status)) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.fehler || `HTTP ${response.status}`);
      }
      const payload = await response.json().catch(() => ({}));
      setRefreshFeedback(
        "running",
        response.status === 409 || payload.status === "laeuft"
          ? "Crawler läuft im Hintergrund · Status wird automatisch geprüft …"
          : "Aktualisierung wurde angenommen · Crawler startet …",
      );
      pollRefreshStatus();
    } catch (error) {
      setRefreshButton(false);
      const message = refreshErrorMessage(error);
      setRefreshFeedback("error", `Aktualisierung konnte nicht gestartet werden: ${message}`);
      toast(`Aktualisierung konnte nicht gestartet werden: ${message}`);
    }
  }

  async function resumeRunningRefresh() {
    try {
      const response = await fetch(REFRESH_STATUS_URL, { cache: "no-store" });
      if (!response.ok) return;
      const status = await response.json();
      if (status.status === "laeuft") {
        refreshPollAttempts = 0;
        setRefreshButton(true, "Daten werden abgerufen …");
        setRefreshFeedback("running", "Bereits laufende Aktualisierung erkannt · Status wird geprüft …");
        setTimeout(pollRefreshStatus, 500);
      } else if (status.status === "erfolgreich") {
        setRefreshFeedback("success", `Letzte Aktualisierung erfolgreich · ${status.neue_maengel || 0} neue Meldungen.`);
      } else if (status.status === "fehler") {
        setRefreshFeedback("error", status.meldung || "Die letzte Aktualisierung ist fehlgeschlagen.");
      }
    } catch (_) {
      // Der Datenabruf beim Seitenstart bleibt auch ohne Status-Endpunkt nutzbar.
    }
  }

  function download(filename, contents, mimeType) {
    const blob = new Blob(["\ufeff", contents], { type: mimeType });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toCsv(rows) {
    const fields = ["id", "title", "category", "location", "date", "status"];
    return ["id;titel;kategorie;ort;datum;status", ...rows.map((row) => fields.map((field) => `"${String(row[field] ?? "").replaceAll('"', '""')}"`).join(";"))].join("\r\n");
  }

  ["period", "granularity", "fromDate", "toDate"].forEach((id) => $("#" + id).addEventListener("change", () => {
    currentPage = 0;
    $("#customRange").classList.toggle("hidden", $("#period").value !== "custom");
    render();
  }));
  $("#trend").addEventListener("pointermove", showTrendHover);
  $("#trend").addEventListener("pointerleave", hideTrendHover);
  $("#refreshData").addEventListener("click", startRefresh);
  $("#search").addEventListener("input", () => { currentPage = 0; render(); });
  $("#pageSize").addEventListener("change", () => { currentPage = 0; render(); });
  $("#tableStatus").addEventListener("change", () => { currentPage = 0; render(); });
  $("#prev").addEventListener("click", () => { currentPage -= 1; render(); });
  $("#next").addEventListener("click", () => { currentPage += 1; render(); });
  $("#csvExport").addEventListener("click", () => {
    const selectedStatus = $("#tableStatus").value;
    const rows = filteredRows().filter((row) => selectedStatus === "all" || row.status === selectedStatus);
    download("maengelmelder_statistik_export.csv", toCsv(rows), "text/csv;charset=utf-8");
    toast(`${rows.length} gefilterte Meldungen exportiert.`);
  });

  render();
  loadServerData();
  resumeRunningRefresh();
})();
