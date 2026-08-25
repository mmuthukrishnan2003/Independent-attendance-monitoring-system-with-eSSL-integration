require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const routes = require('./routes');
const scheduler = require('./jobs/scheduler');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend dashboard (static files) from ../../frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

app.use('/api', routes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'essl-attendance-monitor', time: new Date().toISOString() });
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.APP_PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n=== eSSL Attendance Monitor ===`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Dashboard: http://172.16.0.111:${PORT}/`);
  console.log(`API base:  http://172.16.0.111:${PORT}/api`);
  console.log(`This system runs independently from eSSL TimeTrack Lite.\n`);

  scheduler.init().catch((err) => console.error('[Scheduler] init failed:', err.message));
});
