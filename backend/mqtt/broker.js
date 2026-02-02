import Aedes from 'aedes';
import { createServer } from 'net';

const PORT = 1883;
const aedes = new Aedes();

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