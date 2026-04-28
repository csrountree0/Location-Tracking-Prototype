import Aedes from 'aedes';
import { createServer } from 'net';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 1883;
const aedes = new Aedes();

aedes.authenticate = (_client, username, password, callback) => {
  const validUser = username === process.env.MQTT_USERNAME;
  const validPass = password && password.toString() === process.env.MQTT_PASSWORD;
  if (validUser && validPass) {
    callback(null, true);
  } else {
    const error = new Error('Authentication failed');
    error.returnCode = 4;
    callback(error, false);
  }
};

const server = createServer(aedes.handle);

// client connects to broker
aedes.on('client', (client) => {
  console.log(`Client connected: ${client.id}`);
});

// client disconnects
aedes.on('clientDisconnect', (client) => {
  console.log(`Client disconnected: ${client.id}`);
});

// publisher publishes
aedes.on('publish', (packet, client) => {
  if (client) {
    console.log(`Message from ${client.id} on topic "${packet.topic}": ${packet.payload.toString()}`);
  }
});

// client subscribes to a topic
aedes.on('subscribe', (subscriptions, client) => {
  console.log(`${client.id} subscribed to: ${subscriptions.map(s => s.topic).join(', ')}`);
});

// start server
server.listen(PORT, () => {
  console.log(`MQTT Broker running on: ${PORT}\n`);
});