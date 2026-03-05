# HRMS Lite

A lightweight full-stack Human Resource Management System for managing employees and daily attendance.

## Submission Links

- Live Frontend URL: `TO_BE_ADDED`
- Hosted Backend API URL: `TO_BE_ADDED`
- GitHub Repository: `TO_BE_ADDED`

## Project Overview

HRMS Lite supports:

- Add/list/delete employees
- Mark attendance (Present/Absent) by date
- View attendance records with optional employee/date filters
- Dashboard summary (employee count, present logs, absent logs)
- Present-day totals per employee

## Tech Stack

- Frontend: React (Vite), CSS
- Backend: Python 3 (`FastAPI` + `Uvicorn`)
- Database: SQLite (`backend/hrms_lite.db`)
- Deployment targets: Vercel (frontend static files) + Render/Railway (Python backend)

## Folder Structure

```
.
├── backend/
│   ├── requirements.txt
│   └── server.py
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── public/
│   │   └── config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       └── styles.css
└── README.md
```

## API Endpoints

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/employees`
- `POST /api/employees`
- `DELETE /api/employees/:employeeId`
- `GET /api/attendance?employeeId=&from=&to=`
- `GET /api/employees/:employeeId/attendance?from=&to=`
- `POST /api/attendance`

## Validations & Error Handling

- Required field validation for employee and attendance payloads
- Email format validation
- Duplicate employee ID / duplicate email protection
- Invalid date format handling (`YYYY-MM-DD`)
- Unknown routes handled with `404`
- Proper status codes (`200`, `201`, `400`, `404`, `409`, `500`)
- JSON error messages with meaningful details

## Run Locally

### Prerequisites

- Python 3.10+
- Node.js 18+

### 1) Start Backend

```bash
python3 -m pip install -r backend/requirements.txt
python3 backend/server.py
```

Backend runs at: `http://localhost:8000`

### 2) Start Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

## Deployment

### Frontend (Vercel)

1. Import the repository in Vercel.
2. Set project root directory to `frontend`.
3. Add/update `frontend/public/config.js` so `window.HRMS_API_BASE_URL` points to deployed backend, for example:

```js
window.HRMS_API_BASE_URL = "https://your-backend-domain/api";
```

### Backend (Render or Railway)

1. Create a new Python web service from this repo.
2. Start command:

```bash
python3 backend/server.py
```

3. Add environment variable `PORT` if your platform requires it (already supported in `server.py`).

## Assumptions / Limitations

- Single admin flow only; no authentication.
- SQLite file storage is used for simplicity.
- No pagination for employee/attendance lists.
- Attendance marks are upserted per employee/date (latest status wins).
# HRMS-as
