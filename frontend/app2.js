console.log("APP STARTED");

// INITIALIZE MAP
const map = L.map("map").setView([28.1480, -81.8484], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);


// CIRCLE STYLES (Small Dots)
const activeCartStyle = {
  radius: 6,
  fillColor: "#22c55e",    // Green
  color: "#fff",
  weight: 2,
  opacity: 1,
  fillOpacity: 0.9
};

const staleCartStyle = {
  radius: 6,
  fillColor: "#f97316",    // Orange
  color: "#fff",
  weight: 2,
  opacity: 1,
  fillOpacity: 0.9
};

const stopStyle = {
  radius: 8,
  fillColor: "#ef4444",    // Red
  color: "#fff",
  weight: 2,
  opacity: 1,
  fillOpacity: 0.9
};


// LEGEND
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
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,0.3);vertical-align:middle;margin-right:6px;"></span> Active Cart<br>
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f97316;border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,0.3);vertical-align:middle;margin-right:6px;"></span> Stale Cart<br>
      <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 0 2px rgba(0,0,0,0.3);vertical-align:middle;margin-right:6px;"></span> Stop
    </div>
  `;

  return div;
};

legend.addTo(map);


// FETCH ROUTE STOPS
fetch("https://bloops0.tail98a4de.ts.net:8443/API/routes")
  .then(res => res.json())
  .then(data => {

    if (!Array.isArray(data) || data.length === 0) return;

    const firstRoute = data[0];

    // DRAW ROUTE LINE
    if (firstRoute.path && Array.isArray(firstRoute.path.coordinates)) {

      const routeCoordinates = firstRoute.path.coordinates.map(coord => [
        coord[1],
        coord[0]
      ]);

      const routePolyline = L.polyline(routeCoordinates, {
        color: "blue",
        weight: 4
      }).addTo(map);

      map.fitBounds(routePolyline.getBounds());
    }

    // DRAW STOPS (as circle markers)
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

// LIVE TRACKING
let deviceMarkers = {};

function fetchLiveDevices() {

  fetch("https://bloops0.tail98a4de.ts.net:8443/API/all")
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
          Status: ${diffSeconds > 30 ? "Stale" : "Active"}
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


// INITIAL LOAD
fetchLiveDevices();

// Refresh every 2 seconds
setInterval(fetchLiveDevices, 2000);