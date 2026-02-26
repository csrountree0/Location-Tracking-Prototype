const map = L.map("map").setView([28.1480, -81.8484], 15); // campus coords

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(map);

//first fetch
fetch("https://bloops0.tail98a4de.ts.net/API/routes")
  .then(response => response.json())
  .then(routes => {
    console.log("Routes data:", routes);

    const latlngs = routes.map(point => [point.lat, point.lng]);

    L.polyline(latlngs, {color: "blue"}).addTo(map);
    map.fitBounds(latlngs);
  })
  .catch(error => {
    console.error("Error fetching routes:", error);
  });
  
 // second fetch
 fetch("https://bloops0.tail98a4de.ts.net/API/devices")
  .then(response => response.json())
  .then(devices => {
    console.log("Devices data:", devices);

    devices.forEach(device => {
      L.marker([device.lat, device.lng])
        .addTo(map)
        .bindPopup(`Device ID: ${device.device_id}`);
    });
  })
  .catch(error => {
    console.error("Error fetching devices:", error);
  });
