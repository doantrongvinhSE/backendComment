require('dotenv').config();

const http = require('http');
const app = require('./app');
const realtimeService = require('./services/realtimeService');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

realtimeService.attach(server);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
