const { getAllSettings, setSetting } = require('../services/settingsService');
const { sendDailyWorkingReport } = require('../services/emailService');

async function getSettings(req, res) {
  const settings = await getAllSettings();
  res.json(settings);
}

async function updateSettings(req, res) {
  const updates = req.body; // { key: value, ... }
  for (const [key, value] of Object.entries(updates)) {
    await setSetting(key, value);
  }
  res.json(await getAllSettings());
}

/** Admin manual trigger to send today's (or given date's) daily report immediately */
async function sendReportNow(req, res) {
  const date = req.body.date || new Date().toISOString().slice(0, 10);
  const result = await sendDailyWorkingReport(date);
  res.json(result);
}

module.exports = { getSettings, updateSettings, sendReportNow };
