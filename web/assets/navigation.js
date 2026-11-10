(() => {
  "use strict";

  const layout = document.querySelector("#appLayout");
  const toggle = document.querySelector("#sideToggle");
  if (!layout || !toggle) return;

  const storageKey = "dashboard-navigation-collapsed";

  function applyCollapsed(collapsed) {
    layout.classList.toggle("sidebarCollapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Navigation ausklappen" : "Navigation einklappen");
    const label = toggle.querySelector("span");
    if (label) label.textContent = collapsed ? "Navigation ausklappen" : "Navigation einklappen";
  }

  let collapsed = false;
  try {
    collapsed = window.localStorage.getItem(storageKey) === "1";
  } catch (_) {
    // Die Navigation bleibt auch ohne lokalen Speicher vollständig nutzbar.
  }
  applyCollapsed(collapsed);

  toggle.addEventListener("click", () => {
    collapsed = !layout.classList.contains("sidebarCollapsed");
    applyCollapsed(collapsed);
    try {
      window.localStorage.setItem(storageKey, collapsed ? "1" : "0");
    } catch (_) {
      // Der Zustand gilt dann nur für die aktuelle Seite.
    }
  });
})();
