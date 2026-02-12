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

// get a device by name, or create it if it doesn't exist
export async function getOrCreateDevice(deviceName) {
  const client = await pool.connect();
  try {
    // find existing device
    const selectResult = await client.query(
      'SELECT id FROM devices WHERE name = $1',
      [deviceName]
    );

    if (selectResult.rows.length > 0) {
      return selectResult.rows[0].id;
    }

    // if device doesnt exist then create it
    const insertResult = await client.query(
      'INSERT INTO devices (name) VALUES ($1) RETURNING id',
      [deviceName]
    );

    return insertResult.rows[0].id;
  } finally {
    client.release();
  }
}


// Insert a location record into the database
export async function insertLocation(deviceId, lat, lon, timestamp) {
  const result = await pool.query(
    `INSERT INTO locations (device_id, lat, lon, recorded_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, device_id, lat, lon, recorded_at`,
    [deviceId, lat, lon, timestamp || new Date()]
  );

  return result.rows[0]; // return the newly inserted record.
}

// process and store location data from MQTT message
export async function processLocationData(data) {
  const { Device, lat, lon, timestamp } = data;

  // get/create the device
  const deviceId = await getOrCreateDevice(Device);

  // insert location record
  const location = await insertLocation(deviceId, lat, lon, timestamp);

  return {
    deviceId,
    deviceName: Device,
    location
  };
}

// close the connection
export async function closePool() {
  await pool.end();
}

// test database connection: node db.js
async function testConnection() {
  console.log(process.env.DB_HOST);
  try {
    const res = await pool.query('SELECT NOW() AS time');
    console.log('Connection successful:', res.rows[0].time);
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    await pool.end();
  }
}

if (process.argv[1].endsWith('db.js')) {
  testConnection();
}

export default pool;
