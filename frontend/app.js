console.log("APP JS IS RUNNING");
console.log("APP STARTED");

const map = L.map("map").setView([28.1480, -81.8484], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(map);


// Fetch and display routes
fetch("https://bloops0.tail98a4de.ts.net/API/routes")
  .then(res => res.json())
  .then(data => {
    console.log("RAW ROUTES DATA:", data);

    if (!Array.isArray(data) || data.length === 0) {
      console.error("No routes returned");
      return;
    }

    const firstRoute = data[0];
    const path = firstRoute.path;

    if (!path || !path.coordinates || !Array.isArray(path.coordinates)) {
      console.error("Route path is missing or invalid");
      return;
    }

    // Convert GeoJSON [lon, lat] to Leaflet [lat, lng]
    const routeCoordinates = path.coordinates.map(coord => [coord[1], coord[0]]);

    // Draw polyline
    const routePolyline = L.polyline(routeCoordinates, { color: "blue", weight: 4 }).addTo(map);

    // Fit map to route bounds
    map.fitBounds(routePolyline.getBounds());

    // Start/End markers
    L.marker(routeCoordinates[0]).addTo(map).bindPopup("Start").openPopup();
    L.marker(routeCoordinates[routeCoordinates.length - 1]).addTo(map).bindPopup("End");
  })
  .catch(err => console.error("Routes fetch error:", err));

// Fetch and display devices
let deviceMarkers = {};

function fetchAndUpdateDevices() {
  fetch("https://bloops0.tail98a4de.ts.net/API/devices")
    .then(res => res.json())
    .then(devices => {
      console.log("DEVICES DATA:", devices);

      devices.forEach(device => {
        const key = device.device_id;

        // Normalize lat/lng
        const lat = Number(device.lat);
        const lng = Number(device.lon);
        if (isNaN(lat) || isNaN(lng)) {
          console.error("Invalid device coordinates:", device);
          return;
        }

        console.log(`Device ${device.device_id}: ${lat}, ${lng}`);

        if (deviceMarkers[key]) {
          // Move existing marker
          deviceMarkers[key].setLatLng([lat, lng]);
        } else {
          // Create new marker
          const marker = L.marker([lat, lng])
            .addTo(map)
            .bindPopup(device.name || device.device_id);
          deviceMarkers[key] = marker;
        }
      });
    })
    .catch(err => console.error("Devices fetch error:", err));
}

// Initial fetch
fetchAndUpdateDevices();

// Refresh every 5 seconds
setInterval(fetchAndUpdateDevices, 5000);
