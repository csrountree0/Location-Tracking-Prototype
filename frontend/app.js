console.log("APP STARTED");

// INITIALIZE MAP
const map = L.map("map").setView([28.1480, -81.8484], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(map);

// CUSTOM ICONS
const stopIcon = L.icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  iconSize: [32, 32]
});

const activeCartIcon = L.icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  iconSize: [32, 32]
});

const staleCartIcon = L.icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
  iconSize: [32, 32]
});

// STATUS PANEL (TOP RIGHT)
const statusControl = L.control({ position: "topright" });

statusControl.onAdd = function () {
  const div = L.DomUtil.create("div", "status-panel");
  div.id = "statusPanel";
  div.innerHTML = `
    <h4>Device Status</h4>
    Waiting for data...
  `;
  return div;
};

statusControl.addTo(map);

// FETCH AND DISPLAY HISTORICAL ROUTE
fetch("https://bloops0.tail98a4de.ts.net/API/routes")
  .then(res => res.json())
  .then(data => {

    if (!Array.isArray(data) || data.length === 0) return;

    const firstRoute = data[0];

    if (firstRoute.path?.coordinates) {
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

    if (firstRoute.stops) {
      firstRoute.stops.forEach(stop => {
        if (stop.location?.coordinates) {
          const coords = stop.location.coordinates;

          L.marker([coords[1], coords[0]], { icon: stopIcon })
            .addTo(map)
            .bindPopup(stop.name || "Stop");
        }
      });
    }

  })
  .catch(err => console.error("Routes fetch error:", err));

// LIVE DEVICE TRACKING
let deviceMarkers = {};

function fetchAndUpdateDevices() {
  fetch("https://bloops0.tail98a4de.ts.net/API/devices")
    .then(res => res.json())
    .then(devices => {

      devices.forEach(device => {

        const key = device.device_id;
        const lat = Number(device.lat);
        const lng = Number(device.lon);
        if (isNaN(lat) || isNaN(lng)) return;

        const recordedTime = new Date(device.recorded_at);
        const now = new Date();
        const diffSeconds = Math.floor((now - recordedTime) / 1000);
        const localTime = recordedTime.toLocaleString();

        const isStale = diffSeconds > 30;
        const iconToUse = isStale ? staleCartIcon : activeCartIcon;
        const statusText = isStale
          ? `⚠️ Stale (${diffSeconds}s old)`
          : `🟢 Active (${diffSeconds}s ago)`;

        // Update status panel
        const panel = document.getElementById("statusPanel");
        panel.innerHTML = `
          <h4>Device Status</h4>
          <b>${device.name}</b><br>
          Device ID: ${key}<br>
          Lat: ${lat.toFixed(5)}<br>
          Lng: ${lng.toFixed(5)}<br>
          Recorded: ${localTime}<br>
          Status: ${statusText}<br>
          <hr>
          <b>System Time:</b><br>
          ${now.toLocaleString()}
        `;

        if (deviceMarkers[key]) {
          deviceMarkers[key].setLatLng([lat, lng]);
          deviceMarkers[key].setIcon(iconToUse);
        } else {
          deviceMarkers[key] = L.marker([lat, lng], { icon: iconToUse })
            .addTo(map)
            .bindPopup(device.name);
        }

      });

    })
    .catch(err => console.error("Devices fetch error:", err));
}

fetchAndUpdateDevices();
setInterval(fetchAndUpdateDevices, 5000);

// MAP LEGEND
const legend = L.control({ position: "bottomright" });

legend.onAdd = function () {
  const div = L.DomUtil.create("div", "info legend");

  div.innerHTML = `
    <h4>Map Key</h4>
    <div><span style="color:blue;">&#8212;&#8212;&#8212;</span> Historical Route</div>
    <div><img src="https://maps.google.com/mapfiles/ms/icons/red-dot.png" width="16"/> Stop</div>
    <div><img src="https://maps.google.com/mapfiles/ms/icons/green-dot.png" width="16"/> Active Device</div>
    <div><img src="https://maps.google.com/mapfiles/ms/icons/orange-dot.png" width="16"/> Stale Device</div>
  `;

  return div;
};

legend.addTo(map);
