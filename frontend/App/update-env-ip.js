const os = require('os');
const fs = require('fs');

const interfaces = os.networkInterfaces();
let ip = '';

for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      ip = iface.address;
      break;
    }
  }
  if (ip) break;
}

if (ip) {
  fs.writeFileSync('.env', `API_IP=${ip}\n`);
  console.log('✅ .env updated with local IP:', ip);
} else {
  console.log('❌ Could not find IP address');
}
