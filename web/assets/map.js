(() => {
  "use strict";

  const viewport = document.querySelector("#mapViewport");
  const world = document.querySelector("#mapWorld");
  const coordinates = document.querySelector("#mapCoordinates");
  const scaleLabel = document.querySelector("#mapScale");
  if (!viewport || !world) return;

  const bounds = { west: 8.25, east: 8.61, south: 49.38, north: 49.60 };
  const state = { x: 0, y: 0, scale: 1, dragging: false, pointerId: null, startX: 0, startY: 0 };

  function applyTransform() {
    world.style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
    scaleLabel.textContent = `Zoom ${Math.round(state.scale * 100)} %`;
  }

  function setScale(nextScale) {
    state.scale = Math.max(0.8, Math.min(4, nextScale));
    applyTransform();
  }

  function updateCoordinates(event) {
    const rect = viewport.getBoundingClientRect();
    const localX = ((event.clientX - rect.left - rect.width / 2 - state.x) / state.scale) + rect.width / 2;
    const localY = ((event.clientY - rect.top - rect.height / 2 - state.y) / state.scale) + rect.height / 2;
    const longitude = bounds.west + (localX / rect.width) * (bounds.east - bounds.west);
    const latitude = bounds.north - (localY / rect.height) * (bounds.north - bounds.south);
    coordinates.textContent = `${latitude.toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}° N · ${longitude.toLocaleString("de-DE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}° E`;
  }

  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    setScale(state.scale * (event.deltaY < 0 ? 1.12 : 0.89));
  }, { passive: false });
  viewport.addEventListener("pointerdown", (event) => {
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.startX = event.clientX - state.x;
    state.startY = event.clientY - state.y;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("isDragging");
  });
  viewport.addEventListener("pointermove", (event) => {
    updateCoordinates(event);
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    state.x = event.clientX - state.startX;
    state.y = event.clientY - state.startY;
    applyTransform();
  });
  viewport.addEventListener("pointerup", (event) => {
    if (event.pointerId !== state.pointerId) return;
    state.dragging = false;
    state.pointerId = null;
    viewport.classList.remove("isDragging");
  });
  viewport.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 60 : 24;
    if (event.key === "ArrowLeft") state.x += step;
    else if (event.key === "ArrowRight") state.x -= step;
    else if (event.key === "ArrowUp") state.y += step;
    else if (event.key === "ArrowDown") state.y -= step;
    else if (["+", "="].includes(event.key)) setScale(state.scale * 1.15);
    else if (event.key === "-") setScale(state.scale / 1.15);
    else return;
    event.preventDefault();
    applyTransform();
  });
  document.querySelector("#mapZoomIn").addEventListener("click", () => setScale(state.scale * 1.2));
  document.querySelector("#mapZoomOut").addEventListener("click", () => setScale(state.scale / 1.2));
  document.querySelector("#mapReset").addEventListener("click", () => {
    state.x = 0;
    state.y = 0;
    state.scale = 1;
    coordinates.textContent = "49,490° N · 8,430° E";
    applyTransform();
  });
  applyTransform();
})();
