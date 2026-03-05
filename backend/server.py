#!/usr/bin/env python3
import json
import os
import re
import sqlite3
from datetime import UTC, date, datetime
from typing import Any

import uvicorn
from fastapi import FastAPI, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

DB_PATH = os.path.join(os.path.dirname(__file__), "hrms_lite.db")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
VALID_STATUS = {"Present", "Absent"}


class ApiError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def initialize_database() -> None:
    with get_db_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS employees (
                employee_id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                department TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id TEXT NOT NULL,
                attendance_date TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('Present', 'Absent')),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(employee_id, attendance_date),
                FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
            );
            """
        )


def get_required(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if value is None or (isinstance(value, str) and value.strip() == ""):
        raise ApiError(400, f"{key} is required")

    if not isinstance(value, str):
        raise ApiError(400, f"{key} must be a string")

    return value.strip()


def validate_iso_date(value: str, field: str) -> None:
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise ApiError(400, f"{field} must be in YYYY-MM-DD format") from exc


async def read_json_payload(request: Request) -> dict[str, Any]:
    raw = await request.body()
    if len(raw) == 0:
        raise ApiError(400, "Request body is required")

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ApiError(400, "Invalid JSON payload") from exc

    if not isinstance(payload, dict):
        raise ApiError(400, "JSON payload must be an object")

    return payload


app = FastAPI(title="HRMS Lite API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=86400,
)


@app.on_event("startup")
def on_startup() -> None:
    initialize_database()


@app.exception_handler(ApiError)
async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.message})


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    if exc.status_code == 404:
        return JSONResponse(status_code=404, content={"error": "Route not found"})

    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(status_code=exc.status_code, content={"error": message})


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


@app.get("/api/health")
@app.get("/health", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok", "timestamp": utc_now_iso()}


@app.get("/api/employees")
@app.get("/employees", include_in_schema=False)
def list_employees() -> dict[str, list[dict[str, Any]]]:
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT e.employee_id, e.full_name, e.email, e.department, e.created_at,
                   COALESCE(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END), 0) AS present_days
            FROM employees e
            LEFT JOIN attendance a ON a.employee_id = e.employee_id
            GROUP BY e.employee_id
            ORDER BY e.created_at DESC
            """
        ).fetchall()

    return {"data": [dict(row) for row in rows]}


@app.post("/api/employees")
@app.post("/employees", include_in_schema=False)
async def create_employee(request: Request, response: Response) -> dict[str, dict[str, Any]]:
    payload = await read_json_payload(request)
    employee_id = get_required(payload, "employeeId")
    full_name = get_required(payload, "fullName")
    email = get_required(payload, "email")
    department = get_required(payload, "department")

    if not EMAIL_RE.match(email):
        raise ApiError(400, "Email address is not valid")

    now = utc_now_iso()

    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO employees (employee_id, full_name, email, department, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (employee_id, full_name, email.lower(), department, now),
            )
    except sqlite3.IntegrityError as exc:
        message = str(exc)
        if "employees.employee_id" in message or "UNIQUE constraint failed: employees.employee_id" in message:
            raise ApiError(409, "Employee ID already exists")
        if "employees.email" in message or "UNIQUE constraint failed: employees.email" in message:
            raise ApiError(409, "Email already exists")
        raise

    response.status_code = status.HTTP_201_CREATED
    return {
        "data": {
            "employee_id": employee_id,
            "full_name": full_name,
            "email": email.lower(),
            "department": department,
            "created_at": now,
            "present_days": 0,
        }
    }


@app.delete("/api/employees/{employee_id}")
@app.delete("/employees/{employee_id}", include_in_schema=False)
def delete_employee(employee_id: str) -> dict[str, str]:
    if not employee_id:
        raise ApiError(400, "Employee ID is required")

    with get_db_connection() as conn:
        cur = conn.execute("DELETE FROM employees WHERE employee_id = ?", (employee_id,))

    if cur.rowcount == 0:
        raise ApiError(404, "Employee not found")

    return {"message": "Employee deleted successfully"}


@app.post("/api/attendance")
@app.post("/attendance", include_in_schema=False)
async def mark_attendance(request: Request, response: Response) -> dict[str, dict[str, str]]:
    payload = await read_json_payload(request)
    employee_id = get_required(payload, "employeeId")
    attendance_date = get_required(payload, "date")
    attendance_status = get_required(payload, "status")

    if attendance_status not in VALID_STATUS:
        raise ApiError(400, "Status must be Present or Absent")

    validate_iso_date(attendance_date, "date")

    with get_db_connection() as conn:
        employee = conn.execute(
            "SELECT employee_id FROM employees WHERE employee_id = ?", (employee_id,)
        ).fetchone()
        if not employee:
            raise ApiError(404, "Employee not found")

        now = utc_now_iso()
        conn.execute(
            """
            INSERT INTO attendance (employee_id, attendance_date, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(employee_id, attendance_date)
            DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at
            """,
            (employee_id, attendance_date, attendance_status, now, now),
        )

    response.status_code = status.HTTP_201_CREATED
    return {"data": {"employee_id": employee_id, "date": attendance_date, "status": attendance_status}}


@app.get("/api/employees/{employee_id}/attendance")
@app.get("/employees/{employee_id}/attendance", include_in_schema=False)
def employee_attendance(
    employee_id: str,
    from_date: str = Query(default="", alias="from"),
    to_date: str = Query(default="", alias="to"),
) -> dict[str, list[dict[str, Any]]]:
    if not employee_id:
        raise ApiError(400, "Employee ID is required")

    from_date = from_date.strip()
    to_date = to_date.strip()

    if from_date:
        validate_iso_date(from_date, "from")
    if to_date:
        validate_iso_date(to_date, "to")

    with get_db_connection() as conn:
        exists = conn.execute("SELECT employee_id FROM employees WHERE employee_id = ?", (employee_id,)).fetchone()
        if not exists:
            raise ApiError(404, "Employee not found")

        sql = "SELECT employee_id, attendance_date AS date, status, updated_at FROM attendance WHERE employee_id = ?"
        params: list[Any] = [employee_id]

        if from_date:
            sql += " AND attendance_date >= ?"
            params.append(from_date)
        if to_date:
            sql += " AND attendance_date <= ?"
            params.append(to_date)

        sql += " ORDER BY attendance_date DESC"

        rows = conn.execute(sql, params).fetchall()

    return {"data": [dict(row) for row in rows]}


@app.get("/api/attendance")
@app.get("/attendance", include_in_schema=False)
def list_attendance(
    employee_id: str = Query(default="", alias="employeeId"),
    from_date: str = Query(default="", alias="from"),
    to_date: str = Query(default="", alias="to"),
) -> dict[str, list[dict[str, Any]]]:
    employee_id = employee_id.strip()
    from_date = from_date.strip()
    to_date = to_date.strip()

    if from_date:
        validate_iso_date(from_date, "from")
    if to_date:
        validate_iso_date(to_date, "to")

    sql = (
        "SELECT a.employee_id, e.full_name, a.attendance_date AS date, a.status "
        "FROM attendance a "
        "JOIN employees e ON e.employee_id = a.employee_id WHERE 1=1"
    )
    params: list[Any] = []

    if employee_id:
        sql += " AND a.employee_id = ?"
        params.append(employee_id)
    if from_date:
        sql += " AND a.attendance_date >= ?"
        params.append(from_date)
    if to_date:
        sql += " AND a.attendance_date <= ?"
        params.append(to_date)

    sql += " ORDER BY a.attendance_date DESC, a.employee_id ASC"

    with get_db_connection() as conn:
        rows = conn.execute(sql, params).fetchall()

    return {"data": [dict(row) for row in rows]}


@app.get("/api/dashboard")
@app.get("/dashboard", include_in_schema=False)
def dashboard() -> dict[str, dict[str, int]]:
    with get_db_connection() as conn:
        counts = conn.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM employees) AS total_employees,
                (SELECT COUNT(*) FROM attendance WHERE status = 'Present') AS total_present,
                (SELECT COUNT(*) FROM attendance WHERE status = 'Absent') AS total_absent
            """
        ).fetchone()

    return {"data": dict(counts)}


def run_server(port: int = 8000) -> None:
    initialize_database()
    print(f"HRMS Lite FastAPI backend running on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    run_server(port)
