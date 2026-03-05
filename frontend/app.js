console.log("APP STARTED");

// INITIALIZE MAP
const map = L.map("map").setView([28.1480, -81.8484], 15);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);


// ICONS
const activeCartIcon = L.icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  iconSize: [32, 32]
});

const staleCartIcon = L.icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
  iconSize: [32, 32]
});

const stopIcon = L.icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  iconSize: [32, 32]
});


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
      <img src="https://maps.google.com/mapfiles/ms/icons/green-dot.png" width="16"> Active Cart<br>
      <img src="https://maps.google.com/mapfiles/ms/icons/orange-dot.png" width="16"> Stale Cart<br>
      <img src="https://maps.google.com/mapfiles/ms/icons/red-dot.png" width="16"> Stop<br>
      <div style="
        width: 20px;
        height: 4px;
        background: blue;
        display: inline-block;
        margin-right: 5px;
      "></div> Device History Trail
    </div>
  `;

  return div;
};

legend.addTo(map);

// FETCH ROUTE STOPS (STATIC)
fetch("https://bloops0.tail98a4de.ts.net/API/routes")
  .then(res => res.json())
  .then(data => {

    if (!Array.isArray(data) || data.length === 0) return;

    const firstRoute = data[0];

    if (Array.isArray(firstRoute.stops)) {
      firstRoute.stops.forEach(stop => {

        const coords = stop.location?.coordinates;
        if (!coords) return;

        L.marker([coords[1], coords[0]], { icon: stopIcon })
          .addTo(map)
          .bindPopup(stop.name || "Stop");
      });
    }

  })
  .catch(err => console.error("Stops fetch error:", err));

// DEVICE HISTORY (MULTI READY)
let devicePolylines = {};
let deviceMarkers = {};

function fetchFullHistory() {

  fetch("https://bloops0.tail98a4de.ts.net/API/all")
    .then(res => res.json())
    .then(data => {

      if (!Array.isArray(data)) return;

      // Group by device_id
      const grouped = {};

      data.forEach(point => {

        const id = point.device_id;
        const lat = Number(point.lat);
        const lng = Number(point.lon);

        if (isNaN(lat) || isNaN(lng)) return;

        if (!grouped[id]) grouped[id] = [];

        grouped[id].push({
          lat,
          lng,
          recorded_at: point.recorded_at
        });

      });

      // Draw trail per device
      Object.keys(grouped).forEach(id => {

        const sortedPoints = grouped[id]
          .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

        const coordinates = sortedPoints.map(p => [p.lat, p.lng]);

        if (devicePolylines[id]) {
          devicePolylines[id].setLatLngs(coordinates);
        } else {
          devicePolylines[id] = L.polyline(coordinates, {
            color: "blue",
            weight: 4
          }).addTo(map);
        }

      });

    })
    .catch(err => console.error("History fetch error:", err));
}

// LIVE TRACKING (MULTI READY)
function fetchLiveDevices() {

  fetch("https://bloops0.tail98a4de.ts.net/API/devices")
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

        const iconToUse = diffSeconds > 30 ? staleCartIcon : activeCartIcon;

        const popupContent = `
          <b>${device.name || "Golf Cart"}</b><br>
          Device ID: ${id}<br>
          Recorded: ${recordedTime.toLocaleString()}<br>
          Status: ${diffSeconds > 30 ? "Stale" : "Active"}
        `;

        if (deviceMarkers[id]) {
          deviceMarkers[id].setLatLng([lat, lng]);
          deviceMarkers[id].setIcon(iconToUse);
          deviceMarkers[id].setPopupContent(popupContent);
        } else {
          deviceMarkers[id] = L.marker([lat, lng], { icon: iconToUse })
            .addTo(map)
            .bindPopup(popupContent);
        }

      });

    })
    .catch(err => console.error("Live fetch error:", err));
}

// INITIAL LOAD
fetchFullHistory();
fetchLiveDevices();

// Refresh live every 5 seconds
setInterval(fetchLiveDevices, 5000);
