const cron = require('node-cron');
const pool = require('../config/db');
const zk = require('../services/zkDeviceService');
const { markAbsentees } = require('../services/attendanceService');
const { sendDailyWorkingReport } = require('../services/emailService');
const { loadDevicesFromEnv } = require('../config/devices');
const { getSetting } = require('../services/settingsService');

async function registerDevicesFromEnv() {
  const devices = loadDevicesFromEnv();
  for (const d of devices) {
    await zk.upsertDevice(d);
  }
  console.log(`[Scheduler] Registered ${devices.length} device(s) from config.`);
}

function startPollingLoop() {
  const intervalSec = Number(process.env.DEVICE_POLL_INTERVAL_SECONDS || 30);
  console.log(`[Scheduler] Polling all devices every ${intervalSec}s for new punches.`);
  setInterval(() => {
    zk.pollAllDevices().catch((err) => console.error('[Scheduler] pollAllDevices error:', err.message));
  }, intervalSec * 1000);

  // run once immediately on boot
  zk.pollAllDevices().catch((err) => console.error('[Scheduler] initial poll error:', err.message));
}

function startStatusCheckLoop() {
  const intervalSec = Number(process.env.DEVICE_STATUS_CHECK_INTERVAL_SECONDS || 60);
  console.log(`[Scheduler] Checking device online/offline status every ${intervalSec}s.`);
  setInterval(() => {
    zk.checkAllDeviceStatuses().catch((err) => console.error('[Scheduler] status check error:', err.message));
  }, intervalSec * 1000);
}

function startDailyCronJobs() {
  // Mark absentees shortly after midnight for the day that just ended
  cron.schedule('5 0 * * *', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    console.log('[Scheduler] Marking absentees for', yesterday);
    await markAbsentees(yesterday).catch((err) => console.error(err.message));
  });

  // Check every minute whether it's time to send the daily report (time is configurable in Settings)
  cron.schedule('* * * * *', async () => {
    const enabled = (await getSetting('daily_report_email_enabled', 'true')) === 'true';
    if (!enabled) return;
    const sendTime = await getSetting('daily_report_send_time', process.env.DAILY_REPORT_SEND_TIME || '18:30');
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (hhmm === sendTime) {
      const today = now.toISOString().slice(0, 10);
      console.log('[Scheduler] Sending daily working report for', today);
      await sendDailyWorkingReport(today).catch((err) => console.error(err.message));
    }
  });
}

async function init() {
  await registerDevicesFromEnv();
  startPollingLoop();
  startStatusCheckLoop();
  startDailyCronJobs();
}

module.exports = { init };
