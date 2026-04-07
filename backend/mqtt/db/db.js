import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool, types } = pg;

types.setTypeParser(1184, str => str);


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


// insert location into database using postgis geography type
export async function insertLocation(deviceId, lat, lon, timestamp) {
  const result = await pool.query(
    `INSERT INTO locations (device_id, recorded_at, location)
     VALUES ($1, $4, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography)
     RETURNING id, device_id, recorded_at, location`,
    [deviceId, lat, lon, timestamp || new Date()]
  );
  return result.rows[0];
}

// process and store location data from MQTT message
export async function processLocationData(data) {
  const { Device, lat, lon, timestamp } = data;

  // dont write to db if positon is 0,0
  if (!lat || !lon) {
    return null;
  }

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

// test database connection
async function testConnection() {
  console.log(process.env.DB_HOST);
  try {
   console.log(await insertLocation(14,80,80))
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    await pool.end();
  }
}

// for testing connection to db
if (process.argv[1].endsWith('db.js')) {
  testConnection();
}

// close the connection
export async function closePool() {
  await pool.end();
}

export default pool;
