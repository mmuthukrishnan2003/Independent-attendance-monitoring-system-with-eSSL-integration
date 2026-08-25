const express = require('express');
const router = express.Router();

const { authenticate, requireRole, scopeToSelfUnlessAdmin } = require('../middleware/auth');
const authController = require('../controllers/authController');
const employeeController = require('../controllers/employeeController');
const deviceController = require('../controllers/deviceController');
const attendanceController = require('../controllers/attendanceController');
const reportController = require('../controllers/reportController');
const settingsController = require('../controllers/settingsController');

// ---------- Auth (public) ----------
router.post('/auth/login', authController.login);

// everything below requires a valid login
router.use(authenticate);

router.get('/auth/me', authController.me);
router.post('/auth/users', requireRole('admin'), authController.createUser);
router.get('/auth/users', requireRole('admin'), authController.listUsers);
router.post('/auth/change-password', requireRole('admin'), authController.changePassword);

// ---------- Real-time attendance monitoring ----------
router.get('/attendance/today', attendanceController.todayBoard);
router.get('/attendance/recent-punches', attendanceController.recentPunches);
router.get('/attendance/daily-status', attendanceController.dailyStatus);

// ---------- Employee management ----------
router.get('/employees', requireRole('admin', 'manager'), employeeController.listEmployees);
router.get('/employees/:id', scopeToSelfUnlessAdmin('id'), employeeController.getEmployee);
router.put('/employees/:id', requireRole('admin'), employeeController.updateEmployee);
router.get('/employees/:id/history', scopeToSelfUnlessAdmin('id'), employeeController.employeeHistory);
router.get('/employees/:id/punches', scopeToSelfUnlessAdmin('id'), employeeController.employeePunches);

// ---------- Device management (admin only - view/manage devices) ----------
router.get('/devices', requireRole('admin', 'manager'), deviceController.listDevices);
router.post('/devices', requireRole('admin'), deviceController.addDevice);
router.get('/devices/:id', requireRole('admin', 'manager'), deviceController.getDevice);
router.post('/devices/:id/check-status', requireRole('admin'), deviceController.checkStatus);
router.post('/devices/:id/sync', requireRole('admin'), deviceController.syncDevice);
router.get('/devices/:id/records', requireRole('admin', 'manager'), deviceController.deviceRecords);

// ---------- Reports ----------
router.get('/reports/daily', requireRole('admin', 'manager'), reportController.daily);
router.get('/reports/weekly', requireRole('admin', 'manager'), reportController.weekly);
router.get('/reports/monthly', requireRole('admin', 'manager'), reportController.monthly);
router.get('/reports/employee-wise', requireRole('admin', 'manager'), reportController.employeeWise);
router.get('/reports/device-wise', requireRole('admin', 'manager'), reportController.deviceWise);
router.get('/reports/late-arrivals', requireRole('admin', 'manager'), reportController.lateArrivals);
router.get('/reports/early-departures', requireRole('admin', 'manager'), reportController.earlyDepartures);
router.get('/reports/overtime', requireRole('admin', 'manager'), reportController.overtime);
router.get('/reports/total-hours', requireRole('admin', 'manager'), reportController.totalHours);

// ---------- Settings (email toggles, thresholds) - admin only ----------
router.get('/settings', requireRole('admin'), settingsController.getSettings);
router.put('/settings', requireRole('admin'), settingsController.updateSettings);
router.post('/settings/send-daily-report-now', requireRole('admin'), settingsController.sendReportNow);

module.exports = router;
