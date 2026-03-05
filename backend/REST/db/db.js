import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const { Pool, types } = pg;

types.setTypeParser(1184, str => str);

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
     WHERE l.recorded_at >= CURRENT_DATE
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


// get all location data (testing mainly)
export async function getAllLocations() {
  const result = await pool.query(
   `SELECT
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


// get the eta for each device following a given route
export async function getNextStopWithETA(routeId, startTime, endTime) {
  const result = await pool.query(`
    WITH ordered_locations AS (
      SELECT 
        l.id as location_id,
        l.device_id,
        d.name as device_name,
        l.recorded_at,
        l.location,
        ST_LineLocatePoint(r.path::geometry, l.location::geometry) as device_pct,
        LAG(ST_LineLocatePoint(r.path::geometry, l.location::geometry)) 
          OVER (PARTITION BY l.device_id ORDER BY l.recorded_at) as prev_pct,
        LAG(l.recorded_at) 
          OVER (PARTITION BY l.device_id ORDER BY l.recorded_at) as prev_time
      FROM locations l
      JOIN devices d ON l.device_id = d.id
      CROSS JOIN routes r
      WHERE r.route_id = $1
        AND l.recorded_at BETWEEN $2 AND $3
    ),
    stop_positions AS (
      SELECT 
        s.stop_id,
        s.name,
        rs.stop_order,
        ST_LineLocatePoint(r.path::geometry, s.location::geometry) as stop_pct,
        MAX(rs.stop_order) OVER () as max_stop_order
      FROM stops s
      JOIN route_stops rs ON s.stop_id = rs.stop_id
      CROSS JOIN routes r
      WHERE rs.route_id = $1
    ),
    with_data AS (
      SELECT 
        ol.*,
        sp.stop_id as nearest_stop_id,
        sp.name as nearest_stop_name,
        sp.stop_order as nearest_stop_order,
        sp.stop_pct as nearest_stop_pct,
        sp.max_stop_order,
        first.stop_pct as first_stop_pct,
        last.stop_pct as last_stop_pct,
        AVG(CASE 
          WHEN prev_time IS NOT NULL 
          THEN ABS(device_pct - prev_pct) / 
               NULLIF(EXTRACT(EPOCH FROM (recorded_at - prev_time)) / 60, 0)
        END) OVER (
          PARTITION BY ol.device_id 
          ORDER BY ol.recorded_at 
          ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
        ) as avg_speed,
        CASE 
          WHEN sp.stop_order = 1 AND ol.device_pct > last.stop_pct 
            AND ABS(1.0 - ol.device_pct) <= 0.01 THEN 'at_stop'
          WHEN ABS(ol.device_pct - sp.stop_pct) <= 0.01 THEN 'at_stop'
          WHEN ol.device_pct < sp.stop_pct 
            OR (sp.stop_order = 1 AND ol.device_pct > last.stop_pct) THEN 'approaching'
          ELSE 'departed'
        END as status,
        ROW_NUMBER() OVER (PARTITION BY ol.device_id ORDER BY ol.recorded_at DESC) as rn
      FROM ordered_locations ol
      CROSS JOIN (SELECT stop_pct FROM stop_positions WHERE stop_order = 1) as first
      CROSS JOIN (SELECT stop_pct FROM stop_positions ORDER BY stop_order DESC LIMIT 1) as last
      CROSS JOIN LATERAL (
        SELECT * FROM stop_positions
        ORDER BY 
          CASE 
            WHEN ol.device_pct > (SELECT stop_pct FROM stop_positions ORDER BY stop_order DESC LIMIT 1) 
              AND stop_order = 1 THEN ABS(1.0 - ol.device_pct)
            ELSE ABS(stop_pct - ol.device_pct)
          END
        LIMIT 1
      ) sp
    )
    SELECT 
      wd.location_id,
      wd.device_id,
      wd.device_name,
      wd.recorded_at,
      ST_Y(wd.location::geometry) as lat,
      ST_X(wd.location::geometry) as lon,
      ROUND((wd.device_pct * 100)::numeric, 2) as position_pct,
      wd.nearest_stop_name,
      wd.nearest_stop_order,
      wd.status,
      CASE 
        WHEN wd.status = 'approaching' THEN wd.nearest_stop_name
        ELSE COALESCE(next.name, (SELECT name FROM stop_positions WHERE stop_order = 1))
      END as next_stop_name,
      CASE 
        WHEN wd.status = 'approaching' THEN wd.nearest_stop_order
        ELSE COALESCE(next.stop_order, 1)
      END as next_stop_order,
      ROUND((wd.avg_speed * 100)::numeric, 4) as speed_pct_per_min,
      CASE 
        WHEN wd.avg_speed > 0 THEN 
          ROUND((
            CASE 
              WHEN wd.status = 'approaching' AND wd.nearest_stop_order = 1 THEN 
                ABS(1.0 - wd.device_pct) + wd.first_stop_pct
              WHEN wd.status = 'approaching' THEN 
                ABS(wd.nearest_stop_pct - wd.device_pct)
              WHEN next.stop_pct IS NOT NULL THEN 
                ABS(next.stop_pct - wd.device_pct)
              ELSE 
                ABS(1.0 - wd.device_pct) + wd.first_stop_pct
            END / wd.avg_speed
          )::numeric, 1)
        ELSE NULL 
      END as eta_minutes
    FROM with_data wd
    LEFT JOIN LATERAL (
      SELECT name, stop_order, stop_pct
      FROM stop_positions 
      WHERE stop_order > wd.nearest_stop_order
      ORDER BY stop_order
      LIMIT 1
    ) next ON true
    WHERE wd.rn = 1
    ORDER BY wd.device_id`,
    [routeId, startTime || 'CURRENT_DATE', endTime || '2099-12-31']
  );
  
  return result.rows;
}


// close the connection
export async function closePool() {
  await pool.end();
}

export default pool;
