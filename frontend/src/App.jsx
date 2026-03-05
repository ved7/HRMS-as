import React, { useEffect, useMemo, useState } from "react";

const API_BASE_URL = window.HRMS_API_BASE_URL || "/api";
const EMPTY_DASHBOARD = { total_employees: 0, total_present: 0, total_absent: 0 };

const initialEmployeeForm = { employeeId: "", fullName: "", email: "", department: "" };
const initialAttendanceForm = { employeeId: "", date: "", status: "Present" };
const initialFilterForm = { employeeId: "", from: "", to: "" };

function getErrorMessage(error, fallback = "Request failed") {
  return error instanceof Error ? error.message : fallback;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&family=Geist+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #f7f6f3;
    --canvas:    #ffffff;
    --surface:   #fafaf8;
    --border:    #e8e6e1;
    --border-md: #d4d1cb;
    --text:      #1c1b18;
    --text-2:    #4a4843;
    --muted:     #9a9690;
    --accent:    #2a5bd7;
    --accent-bg: #eef2fd;
    --green:     #1a7f54;
    --green-bg:  #e6f5ee;
    --red:       #c0392b;
    --red-bg:    #fdecea;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
    --radius:    10px;
    --radius-sm: 6px;
    --serif:     'Instrument Serif', Georgia, serif;
    --sans:      'Geist', system-ui, sans-serif;
    --mono:      'Geist Mono', monospace;
  }

  html { background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 14px; line-height: 1.6; -webkit-font-smoothing: antialiased; }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .shell { max-width: 1160px; margin: 0 auto; padding: 40px 28px 100px; }

  /* TOP BAR */
  .topbar {
    display: flex; align-items: flex-end; justify-content: space-between;
    margin-bottom: 36px;
    animation: fadeUp 0.35s ease both;
  }
  .topbar-eyebrow { font-size: 11px; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .topbar-title { font-family: var(--serif); font-size: 32px; font-weight: 400; line-height: 1.1; letter-spacing: -0.01em; }
  .topbar-title em { font-style: italic; color: var(--accent); }

  /* METRICS */
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; animation: fadeUp 0.35s 0.06s ease both; }
  .metric-card {
    background: var(--canvas); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 22px 24px;
    box-shadow: var(--shadow-sm); position: relative; overflow: hidden;
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .metric-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
  .metric-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  }
  .metric-card.mc-total::before { background: linear-gradient(90deg, var(--accent), #6b8ee8); }
  .metric-card.mc-present::before { background: linear-gradient(90deg, var(--green), #4caf80); }
  .metric-card.mc-absent::before { background: linear-gradient(90deg, var(--red), #e05c6c); }
  .metric-icon { font-size: 18px; margin-bottom: 12px; opacity: 0.7; }
  .metric-value { font-family: var(--serif); font-size: 44px; line-height: 1; margin-bottom: 6px; }
  .metric-card.mc-total .metric-value { color: var(--accent); }
  .metric-card.mc-present .metric-value { color: var(--green); }
  .metric-card.mc-absent .metric-value { color: var(--red); }
  .metric-label { font-size: 12px; font-weight: 500; color: var(--text-2); }
  .metric-sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; }

  /* FORMS */
  .forms-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; animation: fadeUp 0.35s 0.1s ease both; }

  /* CARD */
  .card { background: var(--canvas); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-sm); overflow: hidden; }
  .card-header {
    padding: 16px 20px; border-bottom: 1px solid var(--border);
    background: var(--surface);
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
  }
  .card-title { font-size: 13px; font-weight: 600; color: var(--text); }
  .card-badge {
    font-family: var(--mono); font-size: 10.5px; color: var(--muted);
    background: var(--bg); border: 1px solid var(--border);
    padding: 2px 8px; border-radius: 20px; flex-shrink: 0;
  }
  .card-body { padding: 20px; }

  /* FORM FIELDS */
  .form-stack { display: flex; flex-direction: column; gap: 13px; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field-label { font-size: 12px; font-weight: 500; color: var(--text-2); }
  .field input, .field select {
    background: var(--bg); border: 1.5px solid var(--border);
    border-radius: var(--radius-sm); color: var(--text);
    font-family: var(--sans); font-size: 13.5px;
    padding: 9px 12px; outline: none; width: 100%; appearance: none;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .field input::placeholder { color: var(--muted); }
  .field input:hover, .field select:hover { border-color: var(--border-md); }
  .field input:focus, .field select:focus {
    border-color: var(--accent); background: var(--canvas);
    box-shadow: 0 0 0 3px var(--accent-bg);
  }
  .field select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239a9690' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 11px center;
    padding-right: 30px;
  }

  /* BUTTONS */
  .btn {
    font-family: var(--sans); font-size: 13px; font-weight: 500;
    border: none; border-radius: var(--radius-sm); cursor: pointer;
    padding: 9px 16px; transition: all 0.15s;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    white-space: nowrap;
  }
  .btn-primary { background: var(--text); color: #fff; width: 100%; margin-top: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
  .btn-primary:hover { background: #2e2d2a; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
  .btn-primary:active { transform: scale(0.99); }
  .btn-blue { background: var(--accent); color: #fff; box-shadow: 0 1px 3px rgba(42,91,215,0.3); }
  .btn-blue:hover { background: #1e4abf; }
  .btn-ghost { background: transparent; color: var(--text-2); border: 1.5px solid var(--border); }
  .btn-ghost:hover { background: var(--bg); border-color: var(--border-md); }
  .btn-remove { background: transparent; color: var(--muted); border: 1.5px solid transparent; font-size: 12px; padding: 5px 10px; }
  .btn-remove:hover { color: var(--red); border-color: #f5c6c9; background: var(--red-bg); }

  /* STATUS */
  .status-msg { margin-top: 12px; font-size: 12px; display: flex; align-items: center; gap: 6px; }
  .status-msg::before { content: ''; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .status-msg.success { color: var(--green); }
  .status-msg.success::before { background: var(--green); }
  .status-msg.error { color: var(--red); }
  .status-msg.error::before { background: var(--red); }

  /* TABLE SECTION */
  .table-section { margin-bottom: 16px; animation: fadeUp 0.35s 0.14s ease both; }

  /* FILTER BAR */
  .filter-bar { display: flex; align-items: flex-end; gap: 10px; flex-wrap: wrap; }
  .filter-bar .field { flex: 1; min-width: 130px; }
  .filter-actions { display: flex; gap: 8px; }

  /* TABLE */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    font-size: 11px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--muted); padding: 11px 16px; text-align: left;
    background: var(--surface); border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  tbody td { padding: 13px 16px; border-bottom: 1px solid var(--border); font-size: 13.5px; color: var(--text); vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr { transition: background 0.1s; }
  tbody tr:hover td { background: #fafaf8; }

  .cell-mono { font-family: var(--mono); font-size: 12px; color: var(--muted); }
  .cell-name { font-weight: 500; }
  .cell-email { color: var(--text-2); }
  .cell-dept {
    display: inline-flex; align-items: center;
    background: var(--bg); border: 1px solid var(--border);
    font-size: 11.5px; padding: 3px 9px; border-radius: 20px;
    color: var(--text-2); font-weight: 500;
  }
  .cell-days { font-family: var(--mono); font-size: 14px; font-weight: 500; color: var(--accent); }

  /* BADGE */
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11.5px; font-weight: 500; padding: 3px 9px;
    border-radius: 20px;
  }
  .badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .badge.present { background: var(--green-bg); color: var(--green); }
  .badge.present::before { background: var(--green); }
  .badge.absent { background: var(--red-bg); color: var(--red); }
  .badge.absent::before { background: var(--red); }

  /* EMPTY */
  .empty-state { padding: 52px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .empty-icon { font-size: 30px; opacity: 0.3; margin-bottom: 6px; }
  .empty-title { font-size: 14px; font-weight: 500; color: var(--text-2); }
  .empty-sub { font-size: 12.5px; color: var(--muted); max-width: 260px; line-height: 1.5; }

  @media (max-width: 740px) {
    .forms-row, .metrics { grid-template-columns: 1fr; }
    .topbar { flex-direction: column; align-items: flex-start; gap: 12px; }
    .filter-bar { flex-direction: column; align-items: stretch; }
  }
`;

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [attendanceForm, setAttendanceForm] = useState(initialAttendanceForm);
  const [filterForm, setFilterForm] = useState(initialFilterForm);
  const [employeeMsg, setEmployeeMsg] = useState({ text: "", type: "" });
  const [attendanceMsg, setAttendanceMsg] = useState({ text: "", type: "" });
  const [employeesState, setEmployeesState] = useState("loading");
  const [attendanceState, setAttendanceState] = useState("loading");

  useEffect(() => {
    if (employees.length === 0) { setAttendanceForm(p => ({ ...p, employeeId: "" })); return; }
    const exists = employees.some(e => e.employee_id === attendanceForm.employeeId);
    if (!exists) setAttendanceForm(p => ({ ...p, employeeId: employees[0].employee_id }));
  }, [employees, attendanceForm.employeeId]);

  async function loadDashboard() {
    const res = await api("/dashboard");
    setDashboard(res?.data && typeof res.data === "object" ? { ...EMPTY_DASHBOARD, ...res.data } : EMPTY_DASHBOARD);
  }
  async function loadEmployees() {
    setEmployeesState("loading");
    const res = await api("/employees");
    const list = Array.isArray(res?.data) ? res.data : [];
    setEmployees(list);
    setEmployeesState(list.length === 0 ? "empty" : "");
  }
  async function loadAttendance(params = {}) {
    setAttendanceState("loading");
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) query.append(k, v); });
    const res = await api(`/attendance${query.toString() ? "?" + query.toString() : ""}`);
    const list = Array.isArray(res?.data) ? res.data : [];
    setAttendance(list);
    setAttendanceState(list.length === 0 ? "empty" : "");
  }

  useEffect(() => {
    async function init() {
      try { await Promise.all([loadDashboard(), loadEmployees(), loadAttendance()]); }
      catch (e) { const m = getErrorMessage(e); setEmployeesState(m); setAttendanceState(m); }
    }
    init();
  }, []);

  async function handleCreateEmployee(e) {
    e.preventDefault();
    setEmployeeMsg({ text: "Saving…", type: "" });
    try {
      const res = await api("/employees", { method: "POST", body: JSON.stringify(employeeForm) });
      const created = res?.data && typeof res.data === "object" ? res.data : null;
      if (created?.employee_id) {
        setEmployees((prev) => {
          if (prev.some((emp) => emp.employee_id === created.employee_id)) return prev;
          return [created, ...prev];
        });
        setEmployeesState("");
      }
      setEmployeeForm(initialEmployeeForm);
      setEmployeeMsg({ text: "Employee created successfully.", type: "success" });
      await Promise.allSettled([loadEmployees(), loadDashboard()]);
    } catch (err) { setEmployeeMsg({ text: getErrorMessage(err), type: "error" }); }
  }
  async function handleCreateAttendance(e) {
    e.preventDefault();
    setAttendanceMsg({ text: "Saving…", type: "" });
    try {
      await api("/attendance", { method: "POST", body: JSON.stringify(attendanceForm) });
      setAttendanceMsg({ text: "Attendance saved.", type: "success" });
      await Promise.all([loadAttendance(filterForm), loadEmployees(), loadDashboard()]);
    } catch (err) { setAttendanceMsg({ text: getErrorMessage(err), type: "error" }); }
  }
  async function handleDeleteEmployee(id) {
    if (!window.confirm(`Delete employee ${id}? This will also remove their attendance records.`)) return;
    try {
      await api(`/employees/${id}`, { method: "DELETE" });
      setFilterForm(initialFilterForm);
      await Promise.all([loadEmployees(), loadAttendance(), loadDashboard()]);
    } catch (err) { setEmployeesState(getErrorMessage(err)); }
  }
  async function handleApplyFilters(e) {
    e.preventDefault();
    try { await loadAttendance(filterForm); }
    catch (err) { setAttendanceState(getErrorMessage(err)); }
  }
  async function handleResetFilters() {
    setFilterForm(initialFilterForm);
    await loadAttendance();
  }

  return (
    <>
      <style>{css}</style>
      <div className="shell">

        {/* TOPBAR */}
        <div className="topbar">
          <div>
            <p className="topbar-eyebrow">Human Resource Management System</p>
            <h1 className="topbar-title">HRMS</h1>
          </div>
        </div>

        {/* METRICS */}
        <div className="metrics">
          <div className="metric-card mc-total">
            <div className="metric-value">{dashboard.total_employees ?? 0}</div>
            <div className="metric-label">Total Employees</div>
            <div className="metric-sub">Registered in system</div>
          </div>
          <div className="metric-card mc-present">
            <div className="metric-value">{dashboard.total_present ?? 0}</div>
            <div className="metric-label">Present Logs</div>
            <div className="metric-sub">All-time attendance</div>
          </div>
          <div className="metric-card mc-absent">
            
            <div className="metric-value">{dashboard.total_absent ?? 0}</div>
            <div className="metric-label">Absent Logs</div>
            <div className="metric-sub">All-time absences</div>
          </div>
        </div>

        {/* FORMS */}
        <div className="forms-row">
          <div className="card">
            <div className="card-header"><span className="card-title">Add Employee</span></div>
            <div className="card-body">
              <form className="form-stack" onSubmit={handleCreateEmployee}>
                <div className="field">
                  <label className="field-label">Employee ID</label>
                  <input type="text" required value={employeeForm.employeeId}
                    onChange={e => setEmployeeForm(p => ({ ...p, employeeId: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">Full Name</label>
                  <input type="text" required value={employeeForm.fullName}
                    onChange={e => setEmployeeForm(p => ({ ...p, fullName: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">Email Address</label>
                  <input type="email" required value={employeeForm.email}
                    onChange={e => setEmployeeForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">Department</label>
                  <input type="text" required value={employeeForm.department}
                    onChange={e => setEmployeeForm(p => ({ ...p, department: e.target.value }))} />
                </div>
                <button type="submit" className="btn btn-primary">Create Employee</button>
              </form>
              {employeeMsg.text && <p className={`status-msg ${employeeMsg.type}`}>{employeeMsg.text}</p>}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Mark Attendance</span></div>
            <div className="card-body">
              <form className="form-stack" onSubmit={handleCreateAttendance}>
                <div className="field">
                  <label className="field-label">Employee</label>
                  <select required value={attendanceForm.employeeId}
                    onChange={e => setAttendanceForm(p => ({ ...p, employeeId: e.target.value }))}>
                    {employees.length === 0
                      ? <option value="">No employees found</option>
                      : employees.map(emp => (
                        <option key={emp.employee_id} value={emp.employee_id}>
                          {emp.employee_id} — {emp.full_name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Date</label>
                  <input type="date" required value={attendanceForm.date}
                    onChange={e => setAttendanceForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">Status</label>
                  <select required value={attendanceForm.status}
                    onChange={e => setAttendanceForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">Save Attendance</button>
              </form>
              {attendanceMsg.text && <p className={`status-msg ${attendanceMsg.type}`}>{attendanceMsg.text}</p>}
            </div>
          </div>
        </div>

        {/* EMPLOYEES TABLE */}
        <div className="card table-section">
          <div className="card-header">
            <span className="card-title">Employees</span>
            <span className="card-badge">{employees.length} total</span>
          </div>
          {employees.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <p className="empty-title">No employees yet</p>
              <p className="empty-sub">Add your first employee using the form above to get started.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee ID</th><th>Name</th><th>Email</th>
                    <th>Department</th><th>Present Days</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.employee_id}>
                      <td><span className="cell-mono">{emp.employee_id}</span></td>
                      <td><span className="cell-name">{emp.full_name}</span></td>
                      <td><span className="cell-email">{emp.email}</span></td>
                      <td><span className="cell-dept">{emp.department}</span></td>
                      <td><span className="cell-days">{emp.present_days}</span></td>
                      <td>
                        <button className="btn btn-remove" onClick={() => handleDeleteEmployee(emp.employee_id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ATTENDANCE TABLE */}
        <div className="card table-section">
          <div className="card-header">
            <span className="card-title">Attendance Records</span>
            <form className="filter-bar" onSubmit={handleApplyFilters}>
              <div className="field">
                <label className="field-label">Employee</label>
                <select value={filterForm.employeeId}
                  onChange={e => setFilterForm(p => ({ ...p, employeeId: e.target.value }))}>
                  <option value="">All employees</option>
                  {employees.map(emp => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.employee_id} — {emp.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label">From</label>
                <input type="date" value={filterForm.from}
                  onChange={e => setFilterForm(p => ({ ...p, from: e.target.value }))} />
              </div>
              <div className="field">
                <label className="field-label">To</label>
                <input type="date" value={filterForm.to}
                  onChange={e => setFilterForm(p => ({ ...p, to: e.target.value }))} />
              </div>
              <div className="filter-actions">
                <button type="submit" className="btn btn-blue">Apply</button>
                <button type="button" className="btn btn-ghost" onClick={handleResetFilters}>Reset</button>
              </div>
            </form>
          </div>
          {attendance.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p className="empty-title">No records found</p>
              <p className="empty-sub">Try adjusting filters or mark attendance to see records here.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Employee ID</th><th>Name</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {attendance.map(rec => (
                    <tr key={`${rec.employee_id}-${rec.date}-${rec.status}`}>
                      <td><span className="cell-mono">{rec.date}</span></td>
                      <td><span className="cell-mono">{rec.employee_id}</span></td>
                      <td><span className="cell-name">{rec.full_name || "—"}</span></td>
                      <td><span className={`badge ${rec.status.toLowerCase()}`}>{rec.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
