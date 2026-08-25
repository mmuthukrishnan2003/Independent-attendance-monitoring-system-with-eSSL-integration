const ExcelJS = require('exceljs');
const reportService = require('../services/reportService');

function dateRangeFromQuery(req) {
  const today = new Date().toISOString().slice(0, 10);
  return { from: req.query.from || today, to: req.query.to || today };
}

async function daily(req, res) {
  const { from, to } = dateRangeFromQuery(req);
  const rows = await reportService.attendanceRange({ from, to, employeeId: req.query.employeeId, department: req.query.department });
  respond(req, res, rows, 'daily_attendance_report');
}

async function weekly(req, res) {
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const fromDate = new Date(to);
  fromDate.setDate(fromDate.getDate() - 7);
  const from = req.query.from || fromDate.toISOString().slice(0, 10);
  const rows = await reportService.attendanceRange({ from, to, employeeId: req.query.employeeId, department: req.query.department });
  respond(req, res, rows, 'weekly_attendance_report');
}

async function monthly(req, res) {
  const to = req.query.to || new Date().toISOString().slice(0, 10);
  const fromDate = new Date(to);
  fromDate.setDate(fromDate.getDate() - 30);
  const from = req.query.from || fromDate.toISOString().slice(0, 10);
  const rows = await reportService.attendanceRange({ from, to, employeeId: req.query.employeeId, department: req.query.department });
  respond(req, res, rows, 'monthly_attendance_report');
}

async function employeeWise(req, res) {
  const { from, to } = dateRangeFromQuery(req);
  const rows = await reportService.totalWorkingHoursReport({ from, to, employeeId: req.query.employeeId });
  respond(req, res, rows, 'employee_wise_report');
}

async function deviceWise(req, res) {
  const { from, to } = dateRangeFromQuery(req);
  const rows = await reportService.deviceWiseReport({ from, to, deviceId: req.query.deviceId });
  respond(req, res, rows, 'device_wise_report');
}

async function lateArrivals(req, res) {
  const { from, to } = dateRangeFromQuery(req);
  const rows = await reportService.lateArrivals({ from, to });
  respond(req, res, rows, 'late_arrivals_report');
}

async function earlyDepartures(req, res) {
  const { from, to } = dateRangeFromQuery(req);
  const rows = await reportService.earlyDepartures({ from, to });
  respond(req, res, rows, 'early_departures_report');
}

async function overtime(req, res) {
  const { from, to } = dateRangeFromQuery(req);
  const rows = await reportService.overtimeReport({ from, to });
  respond(req, res, rows, 'overtime_report');
}

async function totalHours(req, res) {
  const { from, to } = dateRangeFromQuery(req);
  const rows = await reportService.totalWorkingHoursReport({ from, to, employeeId: req.query.employeeId });
  respond(req, res, rows, 'total_working_hours_report');
}

/** Shared responder: JSON by default, or ?export=xlsx to download an Excel file */
async function respond(req, res, rows, filenameBase) {
  if (req.query.export === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Report');
    if (rows.length) {
      sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key, width: 20 }));
      rows.forEach((row) => sheet.addRow(row));
      sheet.getRow(1).font = { bold: true };
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filenameBase}.xlsx`);
    await workbook.xlsx.write(res);
    return res.end();
  }
  res.json(rows);
}

module.exports = { daily, weekly, monthly, employeeWise, deviceWise, lateArrivals, earlyDepartures, overtime, totalHours };
