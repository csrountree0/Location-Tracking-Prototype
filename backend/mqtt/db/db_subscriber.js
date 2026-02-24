import mqtt from 'mqtt';
import { processLocationData, closePool } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

//mqtt://localhost:1883
const client = mqtt.connect(process.env.url, {
  clientId: 'db_subscriber',
  clean: true
});

// connect to broker
client.on('connect', () => {
  console.log('Database subscriber connected');

  // subscribe to all device topics
  client.subscribe(['devices/+'], (err) => {
    if (!err) {
      console.log('Subscribed to devices/+ topic');
    }
  });
});

// when a message is received, parse it and insert into database
client.on('message', async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    const result = await processLocationData(data);
    console.log(`Stored location for "${result.deviceName}" (device_id: ${result.deviceId}, location_id: ${result.location.id})`);
  } catch (err) {
    console.error('Error processing message:', err.message);
  }
});

client.on('error', (err) => {
  console.error('MQTT Error:', err.message);
});

process.on('SIGINT', async () => {
  console.log('Shutting down database subscriber...');
  client.end();
  await closePool();
  process.exit();
});
