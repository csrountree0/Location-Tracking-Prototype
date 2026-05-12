console.log("APP STARTED");

const API_BASE = "https://your-public-url";

// INITIALIZE MAP
const map = L.map("map").setView([28.1480, -81.8484], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

// CIRCLE STYLES
const activeCartStyle = {
  radius: 6,
  fillColor: "#22c55e",
  color: "#fff",
  weight: 2,
  opacity: 1,
  fillOpacity: 0.9
};

const staleCartStyle = {
  radius: 6,
  fillColor: "#f97316",
  color: "#fff",
  weight: 2,
  opacity: 1,
  fillOpacity: 0.9
};

const stopStyle = {
  radius: 8,
  fillColor: "#ef4444",
  color: "#fff",
  weight: 2,
  opacity: 1,
  fillOpacity: 0.9
};

// LEGEND, KEY
const legend = L.control({ position: "bottomright" });

legend.onAdd = function () {
  const div = L.DomUtil.create("div");

  div.innerHTML = `
    <div style="
      background: white;
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0,0,0,0.2);
      font-size: 14px;
    ">
      <b>Map Key</b><br><br>
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid white;"></span> Active Cart<br>
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f97316;border:2px solid white;"></span> Stale Cart<br>
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;"></span> Stop
    </div>
  `;
  return div;
};

legend.addTo(map);

// FETCH ROUTE + STOP
fetch(`${API_BASE}/api/routes`)
  .then(res => res.json())
  .then(data => {

    if (!Array.isArray(data) || data.length === 0) return;

    const firstRoute = data[0];

    // Drawing route line
    if (firstRoute.path?.coordinates) {
      const coords = firstRoute.path.coordinates.map(c => [c[1], c[0]]);
      const routeLine = L.polyline(coords, { color: "blue", weight: 4 }).addTo(map);
      map.fitBounds(routeLine.getBounds());
    }

    // Drawing stops
    if (Array.isArray(firstRoute.stops)) {
      firstRoute.stops.forEach(stop => {
        const coords = stop.location?.coordinates;
        if (!coords) return;

        L.circleMarker([coords[1], coords[0]], stopStyle)
          .addTo(map)
          .bindPopup(stop.name || "Stop");
      });
    }

  })
  .catch(err => console.error("Routes fetch error:", err));

// LIVE TRACKING + ETA
let deviceMarkers = {};

function fetchLiveDevices() {

  fetch(`${API_BASE}/api/latestlocations`)
    .then(res => res.json())
    .then(devices => {

      if (!Array.isArray(devices)) return;

      devices.forEach(device => {

        const id = device.device_id;
        const lat = Number(device.lat);
        const lng = Number(device.lon);

        if (isNaN(lat) || isNaN(lng)) return;

        const recordedTime = new Date(device.recorded_at);
        const now = new Date();
        const diffSeconds = Math.floor((now - recordedTime) / 1000);

        const styleToUse = diffSeconds > 30 ? staleCartStyle : activeCartStyle;

        const popupContent = `
          <b>${device.name || "Golf Cart"}</b><br>
          Device ID: ${id}<br>
          Recorded: ${recordedTime.toLocaleString()}<br>
          Status: ${diffSeconds > 30 ? "Stale" : "Active"}<br>
          <div id="eta-${id}">Loading ETA...</div>
        `;

        if (deviceMarkers[id]) {
          deviceMarkers[id].setLatLng([lat, lng]);
          deviceMarkers[id].setStyle(styleToUse);
          deviceMarkers[id].setPopupContent(popupContent);
        } else {
          deviceMarkers[id] = L.circleMarker([lat, lng], styleToUse)
            .addTo(map)
            .bindPopup(popupContent);
        }

      });

    })
    .catch(err => console.error("Live fetch error:", err));
}

// ETA FETCH
function fetchETA() {

  fetch(`${API_BASE}/api/eta?routeId=8`)
    .then(res => res.json())
    .then(data => {

      if (!data.vehicles) return;

      data.vehicles.forEach(vehicle => {

        const id = vehicle.deviceId;
        const eta = vehicle.etaMinutes;
        const nextStop = vehicle.nextStop;
        const status = vehicle.status;

        const etaText = eta !== null
          ? `${eta.toFixed(1)} min`
          : "N/A";

        if (deviceMarkers[id]) {

          const popup = deviceMarkers[id].getPopup();
          if (!popup) return;

          const content = popup.getContent();

          const updated = content.replace(
            /<div id="eta-.*?<\/div>/,
            `<div id="eta-${id}">
              <b>Next Stop:</b> ${nextStop || "N/A"}<br>
              <b>ETA:</b> ${etaText}<br>
              <b>Status:</b> ${status}
            </div>`
          );

          deviceMarkers[id].setPopupContent(updated);
        }

      });

    })
    .catch(err => console.error("ETA fetch error:", err));
}

// START LOOP
fetchLiveDevices();
fetchETA();

setInterval(fetchLiveDevices, 2000);
setInterval(fetchETA, 5000);
