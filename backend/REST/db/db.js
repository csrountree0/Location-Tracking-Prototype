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
       d.id AS device_id, d.name, l.lat, l.lon, l.recorded_at
     FROM devices d
     JOIN locations l ON l.device_id = d.id
     ORDER BY d.id, l.recorded_at DESC`
  );

  return result.rows;
}

// close the connection
export async function closePool() {
  await pool.end();
}

export default pool;
