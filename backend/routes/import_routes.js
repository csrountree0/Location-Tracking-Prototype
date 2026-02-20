import { readFile } from 'fs/promises';
import { DOMParser } from '@xmldom/xmldom';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});


// take gpx file and retrieve the latitudes and longitudes to store the route in the database
async function parseGPX(filePath) {
    const xml = await readFile(filePath, 'utf8');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
  
    // retrieves all the trackpoints, gets the lat and lon for each and stores it in arr
    const trackPoints = []; 
    const trkpts = doc.getElementsByTagName('trkpt');
    for (let i = 0; i < trkpts.length; i++) {
        trackPoints.push([
        parseFloat(trkpts[i].getAttribute('lat')),
        parseFloat(trkpts[i].getAttribute('lon'))
        ]);
    }
  
     // retrieves all the waypoints(stops), gets the lat, lon, and name for each and stores it in arr
    const waypoints = [];
    const wpts = doc.getElementsByTagName('wpt');
    for (let i = 0; i < wpts.length; i++) {
        waypoints.push({
        lat: parseFloat(wpts[i].getAttribute('lat')),
        lon: parseFloat(wpts[i].getAttribute('lon')),
        name: wpts[i].getElementsByTagName('name')[0]?.textContent || `Stop ${i + 1}`
        });
    }
    
    return { trackPoints, waypoints };
}

// insert route from array
async function insertRoute(name, trackPoints) {
  const linestring = `LINESTRING(${trackPoints.map(p => `${p[1]} ${p[0]}`).join(', ')})`; // LINESTRING input is just 'lon1 lat1, lon2 lat2, ...'
  const result = await pool.query(
    `INSERT INTO routes (name, path) VALUES ($1, $2::geography) RETURNING route_id`,
    [name, linestring]
  );
  return result.rows[0].route_id;
}

// insert single stop
async function insertStop(name, lat, lon) {
  const result = await pool.query(
    `INSERT INTO stops (name, location) VALUES ($1, $2::geography) RETURNING stop_id`,
    [name, `POINT(${lon} ${lat})`]
  );
  return result.rows[0].stop_id;
}

// link stops to route
async function linkStopToRoute(routeId, stopId, stopOrder) {
  await pool.query(
    `INSERT INTO route_stops (route_id, stop_id, stop_order) VALUES ($1, $2, $3)`,
    [routeId, stopId, stopOrder]
  );
}

// automate process
export async function importFromGPX(filePath, routeName) {
  const client = await pool.connect();
  
  try {
    // start making changes to db
    await client.query('BEGIN');
    
    const { trackPoints, waypoints } = await parseGPX(filePath);
    
    const routeId = await insertRoute(routeName, trackPoints);
    
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const stopId = await insertStop(wp.name, wp.lat, wp.lon);
      await linkStopToRoute(routeId, stopId, i + 1);
    }
    
    // if no errors then commit changes to db
    await client.query('COMMIT');
    return { routeId, stopCount: waypoints.length };
    
  } catch (err) { 
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// function to test importing, can also serve as actual import function
async function testImport() {
  try {
    const result = await importFromGPX('gpx_files/campus_sample_route.gpx', 'Test_Campus_Route');
    console.log('Success:', result);
  } catch (err) {
    console.error('Failed:', err.message);
  }
}

// testImport();