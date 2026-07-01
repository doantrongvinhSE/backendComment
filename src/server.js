require('dotenv').config();

const http = require('http');
const app = require('./app');
const realtimeService = require('./services/realtimeService');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

async function start() {
  await realtimeService.attach(server);

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
