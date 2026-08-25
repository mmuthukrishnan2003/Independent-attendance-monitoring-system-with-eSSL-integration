if (!getToken()) window.location.href = '/index.html';
const currentUser = getUser();

document.getElementById('whoami').textContent = currentUser ? `${currentUser.username} · ${currentUser.role}` : '';
document.getElementById('logoutBtn').addEventListener('click', () => { clearToken(); window.location.href = '/index.html'; });

if (currentUser && currentUser.role === 'user') {
  document.querySelectorAll('.admin-only').forEach((el) => el.remove());
  document.querySelectorAll('[data-view="employees"], [data-view="devices"], [data-view="reports"]').forEach((el) => el.remove());
}

// ---------------- Nav ----------------
document.getElementById('nav').addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-item');
  if (!btn) return;
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  const view = btn.dataset.view;
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  loadView(view);
});

function loadView(view) {
  if (view === 'live') loadLive();
  if (view === 'employees') loadEmployees();
  if (view === 'devices') loadDevices();
  if (view === 'reports') initReports();
  if (view === 'settings') loadSettings();
  if (view === 'users') loadUsers();
}

function fmtTime(t) { return t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'; }
function fmtDuration(sec) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}
function statusBadge(status) {
  const cls = status === 'PRESENT' ? 'present' : status === 'ABSENT' ? 'absent' : 'half';
  return `<span class="badge ${cls}">${status || 'ABSENT'}</span>`;
}

// ---------------- LIVE BOARD ----------------
let liveInterval;
async function loadLive() {
  await refreshLive();
  clearInterval(liveInterval);
  liveInterval = setInterval(refreshLive, 15000);
}

async function refreshLive() {
  try {
    const board = await api('/attendance/today');
    const present = board.employees.filter((e) => e.status === 'PRESENT' || e.status === 'HALF_DAY').length;
    const late = board.employees.filter((e) => e.is_late).length;
    document.getElementById('liveStats').innerHTML = `
      <div class="stat-chip">Total<b>${board.employees.length}</b></div>
      <div class="stat-chip">Present<b>${present}</b></div>
      <div class="stat-chip">Absent<b>${board.employees.length - present}</b></div>
      <div class="stat-chip">Late<b>${late}</b></div>
    `;
    document.querySelector('#liveTable tbody').innerHTML = board.employees.map((e) => `
      <tr>
        <td>${e.full_name}</td>
        <td>${e.department || '—'}</td>
        <td>${statusBadge(e.status)} ${e.is_late ? '<span class="badge late">LATE</span>' : ''}</td>
        <td>${fmtTime(e.first_punch_in)}</td>
        <td>${fmtTime(e.last_punch_out)}</td>
        <td>${fmtDuration(e.total_seconds)}</td>
      </tr>`).join('');

    const feed = await api('/attendance/recent-punches?limit=40');
    document.querySelector('#feedTable tbody').innerHTML = feed.map((p) => `
      <tr>
        <td>${new Date(p.punch_time).toLocaleString()}</td>
        <td>${p.full_name || p.employee_code || 'Unknown'}</td>
        <td>${p.punch_type}</td>
        <td>${p.device_name}</td>
      </tr>`).join('');
  } catch (err) { console.error(err); }
}

// ---------------- EMPLOYEES ----------------
async function loadEmployees() {
  const employees = await api('/employees');
  renderEmployeeTable(employees);
  document.getElementById('empSearch').oninput = async (e) => {
    const employees = await api(`/employees?search=${encodeURIComponent(e.target.value)}`);
    renderEmployeeTable(employees);
  };
}

function renderEmployeeTable(employees) {
  document.querySelector('#empTable tbody').innerHTML = employees.map((e) => `
    <tr class="clickable" onclick="showEmployeeDetail(${e.id})">
      <td>${e.employee_code || '—'}</td>
      <td>${e.full_name}</td>
      <td>${e.department || '—'}</td>
      <td>${e.designation || '—'}</td>
      <td>${e.status}</td>
    </tr>`).join('');
}

async function showEmployeeDetail(id) {
  const emp = await api(`/employees/${id}`);
  const history = await api(`/employees/${id}/history`);
  document.getElementById('empDetailPanel').querySelector('.panel-head').innerHTML = `<h2>${emp.full_name}</h2>`;
  document.getElementById('empDetail').innerHTML = `
    <div class="emp-detail-body">
      <p class="muted">${emp.designation || ''} ${emp.department ? '· ' + emp.department : ''}</p>
      <div class="emp-field"><span>Employee code</span><span>${emp.employee_code || '—'}</span></div>
      <div class="emp-field"><span>Email</span><span>${emp.email || '—'}</span></div>
      <div class="emp-field"><span>Phone</span><span>${emp.phone || '—'}</span></div>
      <div class="emp-field"><span>Status</span><span>${emp.status}</span></div>
      <h3 style="margin-top:18px;font-size:13px">Recent attendance</h3>
      <div class="table-wrap" style="max-height:260px">
        <table><thead><tr><th>Date</th><th>Status</th><th>In</th><th>Out</th><th>Hours</th></tr></thead>
        <tbody>${history.map((h) => `<tr><td>${h.attendance_date}</td><td>${statusBadge(h.status)}</td><td>${fmtTime(h.first_punch_in)}</td><td>${fmtTime(h.last_punch_out)}</td><td>${fmtDuration(h.total_seconds)}</td></tr>`).join('')}</tbody></table>
      </div>
    </div>`;
}

// ---------------- DEVICES ----------------
async function loadDevices() {
  const devices = await api('/devices');
  renderDeviceGrid(devices);
  const select = document.getElementById('deviceRecordsSelect');
  select.innerHTML = devices.map((d) => `<option value="${d.id}">${d.name} (${d.ip_address})</option>`).join('');
  select.onchange = () => loadDeviceRecords(select.value);
  if (devices.length) loadDeviceRecords(devices[0].id);

  document.getElementById('refreshDevices').onclick = async () => {
    for (const d of devices) await api(`/devices/${d.id}/check-status`, { method: 'POST' });
    loadDevices();
  };
}

function renderDeviceGrid(devices) {
  document.getElementById('deviceGrid').innerHTML = devices.map((d) => `
    <div class="device-card">
      <div class="dname">${d.name}</div>
      <div class="dip">${d.ip_address}:${d.port}</div>
      <div class="drow"><span>Status</span><span class="badge ${d.status === 'online' ? 'online' : 'offline'}">${d.status}</span></div>
      <div class="drow"><span>Last seen</span><span>${d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}</span></div>
      <div class="drow"><span></span><button class="ghost-btn" style="margin-top:8px" onclick="syncDevice(${d.id})">Sync now</button></div>
    </div>`).join('');
}

async function syncDevice(id) {
  await api(`/devices/${id}/sync`, { method: 'POST' });
  loadDevices();
}

async function loadDeviceRecords(id) {
  const records = await api(`/devices/${id}/records`);
  document.querySelector('#deviceRecordsTable tbody').innerHTML = records.map((r) => `
    <tr><td>${new Date(r.punch_time).toLocaleString()}</td><td>${r.full_name || r.employee_code || 'Unknown'}</td><td>${r.punch_type}</td></tr>`).join('');
}

// ---------------- REPORTS ----------------
function initReports() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('reportFrom').value = today;
  document.getElementById('reportTo').value = today;
  document.getElementById('runReport').onclick = runReport;
  document.getElementById('exportReport').onclick = () => runReport(true);
}

async function runReport(exportXlsx = false) {
  const type = document.getElementById('reportType').value;
  const from = document.getElementById('reportFrom').value;
  const to = document.getElementById('reportTo').value;
  const qs = `from=${from}&to=${to}${exportXlsx ? '&export=xlsx' : ''}`;

  if (exportXlsx) {
    const res = await api(`/reports/${type}?${qs}`, { raw: true });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${type}_report.xlsx`; a.click();
    return;
  }

  const rows = await api(`/reports/${type}?${qs}`);
  const table = document.getElementById('reportTable');
  if (!rows.length) { table.querySelector('thead tr').innerHTML = ''; table.querySelector('tbody').innerHTML = '<tr><td>No data for this range.</td></tr>'; return; }
  const cols = Object.keys(rows[0]);
  table.querySelector('thead tr').innerHTML = cols.map((c) => `<th>${c}</th>`).join('');
  table.querySelector('tbody').innerHTML = rows.map((r) => `<tr>${cols.map((c) => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`).join('');
}

// ---------------- SETTINGS ----------------
async function loadSettings() {
  const s = await api('/settings');
  document.getElementById('toggleLateEmail').checked = s.late_email_enabled === 'true';
  document.getElementById('toggleDailyReport').checked = s.daily_report_email_enabled === 'true';
  document.getElementById('officeStart').value = s.office_start_time || '09:30';
  document.getElementById('graceMinutes').value = s.late_grace_minutes || 10;
  document.getElementById('standardHours').value = s.standard_work_hours || 8;
  document.getElementById('reportSendTime').value = s.daily_report_send_time || '18:30';
  document.getElementById('reportRecipients').value = s.daily_report_recipients || '';

  document.getElementById('saveSettings').onclick = async () => {
    await api('/settings', {
      method: 'PUT',
      body: {
        late_email_enabled: document.getElementById('toggleLateEmail').checked,
        daily_report_email_enabled: document.getElementById('toggleDailyReport').checked,
        office_start_time: document.getElementById('officeStart').value,
        late_grace_minutes: document.getElementById('graceMinutes').value,
        standard_work_hours: document.getElementById('standardHours').value,
        daily_report_send_time: document.getElementById('reportSendTime').value,
        daily_report_recipients: document.getElementById('reportRecipients').value,
      },
    });
    document.getElementById('settingsMsg').textContent = 'Settings saved.';
    setTimeout(() => (document.getElementById('settingsMsg').textContent = ''), 2500);
  };

  document.getElementById('sendNow').onclick = async () => {
    const r = await api('/settings/send-daily-report-now', { method: 'POST', body: {} });
    document.getElementById('settingsMsg').textContent = r.sent ? 'Daily report sent.' : `Not sent: ${r.reason}`;
  };
}

// ---------------- USERS ----------------
async function loadUsers() {
  const users = await api('/auth/users');
  document.querySelector('#usersTable tbody').innerHTML = users.map((u) => `
    <tr><td>${u.username}</td><td>${u.role}</td><td>${u.full_name || '—'}</td></tr>`).join('');

  document.getElementById('newUserForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/users', {
        method: 'POST',
        body: {
          username: document.getElementById('newUsername').value,
          password: document.getElementById('newPassword').value,
          role: document.getElementById('newRole').value,
          employeeId: document.getElementById('newEmployeeId').value || null,
        },
      });
      document.getElementById('newUserMsg').textContent = 'User created.';
      document.getElementById('newUserForm').reset();
      loadUsers();
    } catch (err) {
      document.getElementById('newUserMsg').textContent = err.message;
    }
  };
}

// initial view
loadView('live');
