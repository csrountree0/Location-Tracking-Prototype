import mqtt from 'mqtt';


// https://bloops0.tail98a4de.ts.net/broker 
const client = mqtt.connect('mqtt://localhost:1883', {
  clientId: 'test_publisher'
});

let messageCount = 0;

client.on('connect', () => {
  console.log('Publisher connected');
  
  // Publish sample location data every 2 seconds
  setInterval(() => {
    messageCount++;
    
    const locationData = {
      Device: `tracker${Math.floor(Math.random() * 5)}`,
      lat: 20 + Math.floor(Math.random() * 10),
      lon:20 + Math.floor(Math.random() * 10),
      timestamp: new Date().toISOString()
    };
    
    client.publish(`devices/${locationData.Device}`, JSON.stringify(locationData), {
      qos: 1,
      retain: false
    });

    console.log(`Device ${locationData.Device} published data`)

    }, 2000);
});