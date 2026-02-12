// this file mainly serves as a test for the mqtt broker to verify data is received from "devices"

import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://localhost:1883', {
  clientId: 'sample_subscriber',
  clean: true
});

// connect to broker
client.on('connect', () => {
  console.log('Subscriber connected');
  
  // subscribe to topic
  client.subscribe(['devices/+'], (err) => {
    if (!err) {
      console.log('Subscribed to devices topic');
    }
  });
});

// when a message is recieved from a topic parse it and display it
client.on('message', (topic, message) => {
  console.log(`📨 Received on "${topic}": ${message.toString()}`);
  
  // parse JSON
  try {
    const data = JSON.parse(message);
    console.log('   Parsed:', data);
  } catch {
    // if json cant be parsed then display raw
    console.log(message)
}
});

client.on('error', (err) => {
  console.error('Error:', err.message);
});

// shutdown
process.on('SIGINT', () => {
  client.end();
  process.exit();
});