import express from 'express';
import cors from 'cors';
import { getLatestLocations, getAllRoutesWithStops, getAllLocations, getNextStopWithETA, getLatestLocationsWithRouteStatus, closePool } from './db/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// cache 
let routesCache    = null;
let locationsCache = null;
const etaCache         = new Map(); // routeId → formatted response
const routeStatusCache = new Map(); // routeId → formatted response

const ROUTES_INTERVAL_MS    = 3600000; // update every hour
const LOCATIONS_INTERVAL_MS = 1000;  
const ETA_INTERVAL_MS       = 5000;
const STATUS_INTERVAL_MS    = 2000;

// refresh functions 
async function refreshRoutes() {
  try { routesCache = await getAllRoutesWithStops(); }
  catch (err) { console.error('Cache refresh failed (routes):', err.message); }
}

async function refreshLocations() {
  try { locationsCache = await getLatestLocations(); }
  catch (err) { console.error('Cache refresh failed (locations):', err.message); }
}

async function refreshETA(routeId) {
  try {
    const rows = await getNextStopWithETA(routeId);
    etaCache.set(routeId, {
      count: rows.length,
      vehicles: rows.map(v => ({
        deviceId: v.device_id,
        name: v.device_name,
        location: { lat: parseFloat(v.lat), lon: parseFloat(v.lon), positionPct: parseFloat(v.position_pct) },
        lastUpdated: v.recorded_at,
        status: v.status,
        currentOrNearestStop: v.nearest_stop_name,
        nextStop: v.next_stop_name,
        etaMinutes: v.eta_minutes ? parseFloat(v.eta_minutes) : null,
        speedPctPerMin: v.speed_pct_per_min ? parseFloat(v.speed_pct_per_min) : null
      }))
    });
  } catch (err) { console.error(`Cache refresh failed (eta:${routeId}):`, err.message); }
}

async function refreshRouteStatus(routeId) {
  console.log("refreshing Route Deviation...");
  try {
    const rows = await getLatestLocationsWithRouteStatus(routeId);
    routeStatusCache.set(routeId, {
      count: rows.length,
      vehicles: rows.map(v => ({
        deviceId: v.device_id,
        name: v.name,
        location: { lat: parseFloat(v.lat), lon: parseFloat(v.lon) },
        lastUpdated: v.recorded_at,
        distanceFromRouteM: v.distance_from_route_m ? parseFloat(v.distance_from_route_m) : null,
        routeStatus: v.route_status
      }))
    });
  } catch (err) { console.error(`Cache refresh failed (routestatus:${routeId}):`, err.message); }
}

// track which per-route intervals are already running (prevents new timers for same routes)
const etaTimers    = new Map();
const statusTimers = new Map();

function startEtaRefresh(routeId) {
  if (etaTimers.has(routeId)) return;
  refreshETA(routeId);
  etaTimers.set(routeId, setInterval(() => refreshETA(routeId), ETA_INTERVAL_MS));
}

function startStatusRefresh(routeId) {
  if (statusTimers.has(routeId)) return;
  refreshRouteStatus(routeId);
  statusTimers.set(routeId, setInterval(() => refreshRouteStatus(routeId), STATUS_INTERVAL_MS));
}


// endpoints
app.get('/api/latestlocations', (_req, res) => {
  if (!locationsCache) return res.status(503).json({ error: 'Data not yet available' });
  res.json(locationsCache);
});

app.get('/api/routes', (_req, res) => {
  if (!routesCache) return res.status(503).json({ error: 'Data not yet available' });
  res.json(routesCache);
});

// returns all location data
app.get('/api/all', async (_req, res) => {
  try {
    res.json(await getAllLocations());
  } catch (err) {
    console.error('Failed to fetch all locations:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/api/locationstatus', (req, res) => {
  const routeId = parseInt(req.query.routeId);
  if (!routeId) return res.status(400).json({ error: 'routeId required' });
  startStatusRefresh(routeId);
  const cached = routeStatusCache.get(routeId);
  if (!cached) return res.status(503).json({ error: 'Data not yet available' });
  res.json(cached);
});

app.get('/api/eta', async (req, res) => {
  const { routeId, startTime, endTime } = req.query;
  if (!routeId) return res.status(400).json({ error: 'routeId required' });
  const id = parseInt(routeId);

  // bypass cache if time window is provided
  if (startTime || endTime) {
    try {
      const vehicles = await getNextStopWithETA(id, startTime, endTime);
      return res.json({
        count: vehicles.length,
        vehicles: vehicles.map(v => ({
          deviceId: v.device_id,
          name: v.device_name,
          location: { lat: parseFloat(v.lat), lon: parseFloat(v.lon), positionPct: parseFloat(v.position_pct) },
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
      return res.status(500).json({ error: 'Failed to retrieve vehicle ETAs' });
    }
  }

  startEtaRefresh(id);
  const cached = etaCache.get(id);
  if (!cached) return res.status(503).json({ error: 'Data not yet available' });
  res.json(cached);
});

const server = app.listen(PORT, () => {
  console.log(`REST API listening on port ${PORT}`);
});

process.on('SIGINT', async () => {
  [...etaTimers.values(), ...statusTimers.values()].forEach(clearInterval);
  await closePool();
  server.close();
  process.exit();
});


// cache on startup
refreshRoutes();
setInterval(refreshRoutes, ROUTES_INTERVAL_MS);

refreshLocations();
setInterval(refreshLocations, LOCATIONS_INTERVAL_MS);