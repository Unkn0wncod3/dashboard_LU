(() => {
  "use strict";

  function markStaticSnapshot() {
    const refreshButton = document.querySelector("#refreshData");
    const refreshStatus = document.querySelector("#refreshStatus");
    if (refreshButton) refreshButton.hidden = true;
    if (refreshStatus) {
      refreshStatus.dataset.state = "ready";
      refreshStatus.textContent = "Statischer Datenstand des letzten Deployments.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markStaticSnapshot, { once: true });
  } else {
    markStaticSnapshot();
  }
})();

