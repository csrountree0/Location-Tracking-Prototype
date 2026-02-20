import express from 'express';
import { getLatestLocations, closePool } from './db/db.js';

const app = express();
const PORT = process.env.PORT || 3000;


// devices endpoint, retrieves the latest location data, will probably rename to something better
app.get('/devices', async (req, res) => {
  try {
    const devices = await getLatestLocations();
    res.json(devices);
  } catch (err) {
    console.error('Failed to fetch devices:', err);
    res.status(500).json({ error: 'Failed to fetch devices' });
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
