window.HRMS_API_BASE_URL =
  window.HRMS_API_BASE_URL ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:8010/api"
    : "https://hrms-as-backend.vercel.app/api");
