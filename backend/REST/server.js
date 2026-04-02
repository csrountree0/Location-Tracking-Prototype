import express from 'express';
import cors from 'cors';
import { getLatestLocations, getAllRoutesWithStops, getAllLocations, getNextStopWithETA, getLatestLocationsWithRouteStatus, closePool } from './db/db.js';

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors())

// latestlocations endpoint, retrieves the latest location data for each vehicle/device
app.get('/api/latestlocations', async (req, res) => {
  try {
    const devices = await getLatestLocations();
    res.json(devices);
  } catch (err) {
    console.error('Failed to fetch devices:', err);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// routes endpoint, gets all routes and stops
app.get('/api/routes', async (req, res) => {
  try {
    const devices = await getAllRoutesWithStops();
    res.json(devices);
  } catch (err) {
    console.error('Failed to fetch devices:', err);
    res.status(500).json({ error: 'Failed to fetch routes' });
  }
});

// get all location data
app.get('/api/all', async (req, res) => {
  try {
    const devices = await getAllLocations();
    res.json(devices);
  } catch (err) {
    console.error('Failed to fetch devices:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// get latest location per device and on/off route status
// /api/routestatus?routeId=1
app.get('/api/locationstatus', async (req, res) => {
  try {
    const { routeId } = req.query;

    if (!routeId) {
      return res.status(400).json({ error: 'routeId required' });
    }

    const devices = await getLatestLocationsWithRouteStatus(parseInt(routeId));
    res.json({
      count: devices.length,
      vehicles: devices.map(v => ({
        deviceId: v.device_id,
        name: v.name,
        location: { lat: parseFloat(v.lat), lon: parseFloat(v.lon) },
        lastUpdated: v.recorded_at,
        distanceFromRouteM: v.distance_from_route_m ? parseFloat(v.distance_from_route_m) : null,
        routeStatus: v.route_status
      }))
    });
  } catch (err) {
    console.error('Route status endpoint error:', err);
    res.status(500).json({ error: 'Failed to retrieve route status' });
  }
});

// get the eta for all devices along a given route
// /api/eta?routeId=1&startTime=2026-01-01&endTime=2026-12-31 example query
app.get('/api/eta', async (req, res) => {
 
  try {
     console.log(req.query)
    const { routeId, startTime, endTime } = req.query;
    
    if (!routeId) {
      return res.status(400).json({ error: 'routeId required' });
    }
    
    const vehicles = await getNextStopWithETA(
      parseInt(routeId),
      startTime,
      endTime
    );
    
    res.json({
      count: vehicles.length,
      vehicles: vehicles.map(v => ({
        deviceId: v.device_id,
        name: v.device_name,
        location: {
          lat: parseFloat(v.lat),
          lon: parseFloat(v.lon),
          positionPct: parseFloat(v.position_pct)
        },
        lastUpdated: v.recorded_at,
        status: v.status,
        currentOrNearestStop: v.nearest_stop_name,
        nextStop: v.next_stop_name,
        etaMinutes: v.eta_minutes ? parseFloat(v.eta_minutes) : null,
        speedPctPerMin: v.speed_pct_per_min ? parseFloat(v.speed_pct_per_min) : null
      }))
    });
  } catch (err) {
    console.error('ETA endpoint error:', err);
    res.status(500).json({ error: 'Failed to retrieve vehicle ETAs' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`REST API listening on port ${PORT}`);
});

process.on('SIGINT', async () => {
  await closePool();
  server.close();
  process.exit();
});
