// Global Application Utilities and API Client
(function () {
  const TOKEN_KEY = "sas_token";
  const USER_KEY = "sas_user";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function setAuth(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function logout() {
    clearAuth();
    window.location.href = "login.html";
  }

  function requireAuth(requiredRole) {
    const token = getToken();
    const user = getUser();
    if (!token || !user) {
      clearAuth();
      window.location.href = "login.html";
      return null;
    }

    if (requiredRole && user.role !== requiredRole && user.role !== "admin") {
      alert("Access restricted to " + requiredRole + "s.");
      window.location.href = "dashboard.html";
      return null;
    }

    return user;
  }

  async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      if (response.status === 401) {
        clearAuth();
        if (!window.location.pathname.endsWith("login.html")) {
          window.location.href = "login.html";
        }
        throw new Error("Session expired. Please log in again.");
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.message || `Request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  function showToast(message, type = "info") {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast-item ${type}`;

    let icon = "bi-info-circle-fill text-primary";
    if (type === "success") icon = "bi-check-circle-fill text-success";
    if (type === "danger") icon = "bi-exclamation-triangle-fill text-danger";

    toast.innerHTML = `
      <i class="bi ${icon} fs-5"></i>
      <div class="flex-grow-1">${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-sm ms-2" aria-label="Close"></button>
    `;

    toast.querySelector(".btn-close").onclick = () => toast.remove();
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transition = "opacity 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    const div = document.createElement("div");
    div.innerText = String(text);
    return div.innerHTML;
  }

  function renderNavbar(activePage) {
    const navPlaceholder = document.getElementById("navPlaceholder");
    if (!navPlaceholder) return;

    const user = getUser();
    const isAdmin = user && user.role === "admin";
    const userName = user ? user.name : "User";
    const userRole = user ? user.role : "";

    navPlaceholder.innerHTML = `
      <nav class="app-navbar d-flex align-items-center justify-content-between flex-wrap gap-3">
        <div class="d-flex align-items-center gap-3">
          <a href="dashboard.html" class="d-flex align-items-center gap-2 text-decoration-none">
            <div class="brand-badge"><i class="bi bi-mortarboard-fill"></i></div>
            <div>
              <h1 class="brand-title">CampusPulse</h1>
              <p class="brand-sub">Attendance & Parent Notification</p>
            </div>
          </a>
          
          <div class="d-none d-md-flex align-items-center gap-1 ms-3">
            <a href="dashboard.html" class="nav-link-custom ${activePage === 'dashboard' ? 'active' : ''}">
              <i class="bi bi-grid-1x2-fill"></i> Dashboard
            </a>
            <a href="attendance.html" class="nav-link-custom ${activePage === 'attendance' ? 'active' : ''}">
              <i class="bi bi-calendar-check-fill"></i> Mark Attendance
            </a>
            <a href="reports.html" class="nav-link-custom ${activePage === 'reports' ? 'active' : ''}">
              <i class="bi bi-bar-chart-line-fill"></i> Reports & Alerts
            </a>
            ${isAdmin ? `
            <a href="students.html" class="nav-link-custom ${activePage === 'students' ? 'active' : ''}">
              <i class="bi bi-people-fill"></i> Students (Admin)
            </a>` : `
            <a href="students.html" class="nav-link-custom ${activePage === 'students' ? 'active' : ''}">
              <i class="bi bi-people-fill"></i> Student Directory
            </a>`}
          </div>
        </div>

        <div class="d-flex align-items-center gap-3">
          <div class="user-pill d-none d-sm-inline-flex">
            <i class="bi bi-person-circle text-primary fs-6"></i>
            <span>${escapeHtml(userName)}</span>
            <span class="role-badge ${userRole}">${escapeHtml(userRole)}</span>
          </div>
          <button id="logoutBtn" class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" title="Sign Out">
            <i class="bi bi-box-arrow-right"></i> <span class="d-none d-md-inline">Logout</span>
          </button>
        </div>
      </nav>
    `;

    document.getElementById("logoutBtn").addEventListener("click", logout);
  }

  async function loadClassOptions(selectElementId, defaultClass = null) {
    const select = document.getElementById(selectElementId);
    if (!select) return;

    try {
      const data = await apiFetch("/api/students/classes");
      const classes = data.classes || [];
      select.innerHTML = "";

      if (classes.length === 0) {
        select.innerHTML = '<option value="">No classes found</option>';
        return;
      }

      classes.forEach((cls) => {
        const opt = document.createElement("option");
        opt.value = cls;
        opt.textContent = cls;
        if (defaultClass && cls === defaultClass) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    } catch (err) {
      console.error("Failed to load classes:", err);
      select.innerHTML = '<option value="CSE-A">CSE-A</option><option value="CSE-B">CSE-B</option>';
    }
  }

  function getTodayString() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  window.App = {
    getToken,
    getUser,
    setAuth,
    clearAuth,
    logout,
    requireAuth,
    apiFetch,
    showToast,
    escapeHtml,
    renderNavbar,
    loadClassOptions,
    getTodayString
  };
})();
