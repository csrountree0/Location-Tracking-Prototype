import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// get the most recent location for every device
export async function getLatestLocations() {
  const result = await pool.query(
    `SELECT DISTINCT ON (d.id)
       d.id AS device_id, 
       d.name, 
       ST_Y(l.location::geometry) AS lat,
       ST_X(l.location::geometry) AS lon,
       l.recorded_at
     FROM devices d
     JOIN locations l ON l.device_id = d.id
     ORDER BY d.id, l.recorded_at DESC`
  );

  return result.rows;
}

// get all the routes with their corresponding stops
export async function getAllRoutesWithStops() {
  const result = await pool.query(
    `SELECT 
       r.route_id,
       r.name,
       ST_AsGeoJSON(r.path)::json as path,
       (
         SELECT json_agg(
           json_build_object(
             'stop_id', s.stop_id,
             'name', s.name,
             'location', ST_AsGeoJSON(s.location)::json,
             'stop_order', rs.stop_order
           ) ORDER BY rs.stop_order
         )
         FROM route_stops rs
         JOIN stops s ON rs.stop_id = s.stop_id
         WHERE rs.route_id = r.route_id
       ) as stops
     FROM routes r`
  );
  return result.rows;
}


// close the connection
export async function closePool() {
  await pool.end();
}

export default pool;
