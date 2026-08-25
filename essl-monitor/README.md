# eSSL Independent Attendance Monitoring System

A **standalone** attendance monitoring system that runs on its own server and
database. It talks to your eSSL/ZKTeco biometric devices **directly and
read-only** to pull punch logs — it never writes to the devices, never
changes device configuration, and never touches the eSSL TimeTrack Lite
application or its database. TimeTrack Lite can keep running exactly as-is.

## How it stays independent

- **Separate database**: a new Postgres database (`essl_monitor`) on
  `172.16.0.111`, distinct from whatever database TimeTrack Lite uses.
- **Separate server process**: runs as its own Node.js service on port 5000
  (configurable), not inside TimeTrack Lite.
- **Read-only device polling**: connects to each device over the standard
  ZKTeco protocol (TCP port 4370) purely to call `getUsers()` / `getAttendances()`.
  ZK device firmware allows multiple concurrent read connections, so this
  coexists safely alongside TimeTrack Lite polling the same devices. This
  system never calls any write/config command on the devices.

## Your environment

| Item | Value |
|---|---|
| App server | 172.16.0.111 |
| Postgres host | 172.16.0.111 |
| Postgres user / pass | postgres / demo |
| Devices | 172.16.0.4, 172.16.0.44, 172.16.0.5, 172.16.0.20 (port 4370 assumed) |

These are already filled into `backend/.env` — double check the device ports
match your actual configuration (ZKTeco default is 4370).

> **Security note:** `demo` and the JWT secret in `.env` are placeholders.
> Change the Postgres password and `JWT_SECRET` before exposing this to
> production traffic.

## 1. Install prerequisites (on 172.16.0.111)

```bash
# Node.js 18+ and PostgreSQL should already be installed.
node -v
psql --version
```

## 2. Create the new, separate database

```bash
# Run as a user that can reach Postgres; do NOT reuse TimeTrack Lite's DB name
createdb -h 172.16.0.111 -U postgres essl_monitor
# password: demo
```

## 3. Install and configure the backend

```bash
cd essl-monitor/backend
npm install
```

Review `.env` — it's pre-filled with your IPs:

```
PGHOST=172.16.0.111
PGUSER=postgres
PGPASSWORD=demo
PGDATABASE=essl_monitor
DEVICES=Device-1|172.16.0.4|4370,Device-2|172.16.0.44|4370,Device-3|172.16.0.5|4370,Device-4|172.16.0.20|4370
```

Set your real SMTP credentials for late-arrival and daily report emails
(`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `DAILY_REPORT_RECIPIENTS`).

## 4. Create tables and the first admin login

```bash
npm run migrate
npm run seed:admin -- admin YourStrongPassword123
```

This prints the admin username/password you just created — use it to log in.

## 5. Start the service

```bash
npm start
# or for development with auto-reload:
npm run dev
```

You should see:

```
Server running on port 5000
Dashboard: http://172.16.0.111:5000/
```

To keep it running permanently, use a process manager, e.g.:

```bash
npm install -g pm2
pm2 start src/server.js --name essl-monitor
pm2 save
pm2 startup
```

## 6. Open the dashboard

Visit `http://172.16.0.111:5000/` from any machine on the network, sign in
with the admin account from step 4.

## What happens automatically

- Every **30s** (configurable) each device is polled for new punches.
- Every **60s** device online/offline status is refreshed.
- Just after **midnight**, any employee with zero punches the prior day is
  marked **ABSENT**.
- Every minute, the scheduler checks if it's time to send the **daily
  working report** email (time configurable in Settings, default 18:30).
- A **late-arrival email** fires the first time an employee's first punch of
  the day is later than `office_start_time + late_grace_minutes`.
- Both emails can be toggled on/off live from **Admin Portal → Settings**,
  no restart required.

## Roles

- **admin** — full access: employees, devices, reports, settings, users.
- **manager** — view employees, devices, reports (read-only, no settings).
- **user** — can only view their own attendance (`/employees/:id` etc. are
  scoped to their linked `employee_id`).

Create manager/user portal accounts from **Admin Portal → Portal users**.
Link a "user" role account to an `employeeId` so they only see their own data.

## Project layout

```
essl-monitor/
  backend/
    .env                     <- connection info & feature toggles
    src/
      config/db.js           <- separate Postgres pool
      config/devices.js      <- parses DEVICES env var
      db/schema.sql          <- full independent schema
      db/migrate.js          <- creates tables
      db/seedAdmin.js        <- creates first admin login
      services/
        zkDeviceService.js   <- read-only device polling (node-zklib)
        attendanceService.js <- derives daily present/absent/duration/late/OT
        emailService.js      <- late alerts + daily report emails
        reportService.js     <- all report queries
        settingsService.js   <- runtime feature toggles
      controllers/            <- REST endpoint handlers
      routes/index.js         <- all API routes + RBAC
      middleware/auth.js      <- JWT auth + role guards
      jobs/scheduler.js       <- cron: polling, absentee marking, emails
      server.js                <- Express entrypoint
  frontend/
    index.html, dashboard.html
    css/style.css
    js/api.js, login.js, dashboard.js
```

## API quick reference

All routes are under `/api`, JWT bearer auth (`Authorization: Bearer <token>`).

- `POST /api/auth/login`
- `GET  /api/attendance/today` — live board
- `GET  /api/attendance/recent-punches`
- `GET  /api/employees`, `/api/employees/:id`, `/api/employees/:id/history`
- `GET  /api/devices`, `/api/devices/:id/records`, `POST /api/devices/:id/sync`
- `GET  /api/reports/{daily|weekly|monthly|employee-wise|device-wise|late-arrivals|early-departures|overtime|total-hours}?from=YYYY-MM-DD&to=YYYY-MM-DD&export=xlsx`
- `GET/PUT /api/settings`
- `POST /api/settings/send-daily-report-now`

## Troubleshooting

- **Device shows offline**: confirm the app server can reach the device on
  port 4370 (`telnet 172.16.0.4 4370`), and that no firewall between
  172.16.0.111 and the device subnet blocks it.
- **No punches syncing**: click "Sync now" on a device card in the Devices
  view, check the server console log for the specific error.
- **Emails not sending**: verify SMTP credentials in `.env`; check
  `email_log` table for `success=false` rows and the `error` column.
