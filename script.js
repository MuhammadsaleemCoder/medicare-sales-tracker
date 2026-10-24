"use strict";

const $ = (id) => document.getElementById(id);

let mode = "login";
let currentUser = null;
let editingDay = null;
let toastTimer = null;

const USERS_KEY = "medicare_tracker_users";
const SESSION_KEY = "medicare_tracker_session";

// STORAGE HELPERS

function readUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");

    if (!users || typeof users !== "object" || Array.isArray(users)) {
      return {};
    }

    return users;
  } catch (error) {
    console.error("Error reading users:", error);
    return {};
  }
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function dataKey(email) {
  return "medicare_tracker_data_" + normalizeEmail(email);
}

function getEntries() {
  if (!currentUser) return [];

  try {
    const entries = JSON.parse(
      localStorage.getItem(dataKey(currentUser)) || "[]",
    );

    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.error("Error reading sales data:", error);
    return [];
  }
}

function saveEntries(entries) {
  if (!currentUser) {
    showToast("Please sign in first.");
    return false;
  }

  try {
    localStorage.setItem(dataKey(currentUser), JSON.stringify(entries));

    return true;
  } catch (error) {
    console.error("Error saving sales data:", error);
    showToast("Unable to save data in this browser.");
    return false;
  }
}

// LOGIN / REGISTER MODE

function setMode(nextMode) {
  mode = nextMode === "register" ? "register" : "login";

  $("authTitle").textContent =
    mode === "login" ? "Welcome back" : "Create your account";

  $("authSub").textContent =
    mode === "login"
      ? "Sign in to manage your 45-day sales progress."
      : "Create an account to track your daily sales.";

  $("nameField").hidden = mode !== "register";
  $("fullName").required = mode === "register";

  $("authSubmit").textContent = mode === "login" ? "Sign in" : "Create account";

  $("switchText").textContent =
    mode === "login" ? "New here?" : "Already have an account?";

  $("switchMode").textContent =
    mode === "login" ? "Create an account" : "Sign in";

  $("password").autocomplete =
    mode === "login" ? "current-password" : "new-password";

  $("authError").textContent = "";
}

$("switchMode").addEventListener("click", () => {
  setMode(mode === "login" ? "register" : "login");
});

// REGISTER AND LOGIN

$("authForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const email = normalizeEmail($("email").value);
  const password = $("password").value;
  const users = readUsers();

  if (!email || !password) {
    $("authError").textContent = "Please enter your email and password.";
    return;
  }

  if (mode === "register") {
    const name = $("fullName").value.trim();

    if (name.length < 2) {
      $("authError").textContent = "Please enter your name.";
      return;
    }

    if (password.length < 6) {
      $("authError").textContent =
        "Password must contain at least 6 characters.";
      return;
    }

    if (users[email]) {
      $("authError").textContent = "Account already exists. Please sign in.";
      return;
    }

    users[email] = {
      name: name,
      password: password,
    };

    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (error) {
      console.error("Registration error:", error);

      $("authError").textContent =
        "Unable to save your account in this browser.";
      return;
    }

    login(email, users[email]);
    return;
  }

  const user = users[email];

  if (
    !user ||
    typeof user.password !== "string" ||
    user.password !== password
  ) {
    $("authError").textContent =
      "Incorrect email or password. Check your details or register on this browser.";
    return;
  }

  login(email, user);
});

// OPEN DASHBOARD

function login(email, user) {
  currentUser = normalizeEmail(email);

  try {
    sessionStorage.setItem(SESSION_KEY, currentUser);
  } catch (error) {
    console.error("Session storage error:", error);
  }

  $("auth").hidden = true;
  $("app").hidden = false;
  $("userName").textContent = user.name || currentUser;

  initializeTracker();
  cancelEdit();
  render();
}

// LOGOUT

function logout() {
  currentUser = null;

  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error("Logout session error:", error);
  }

  $("app").hidden = true;
  $("auth").hidden = false;

  $("authForm").reset();

  cancelEdit();
  setMode("login");
}

$("logout").addEventListener("click", logout);

// INITIALIZE 45 DAYS

function initializeTracker() {
  const select = $("dayNumber");
  select.innerHTML = "";

  for (let i = 1; i <= 45; i++) {
    const option = document.createElement("option");

    option.value = String(i);
    option.textContent = `Day ${i}`;

    select.appendChild(option);
  }

  $("saleDate").value = localDateString();
}

function localDateString() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// SALE FORM BEHAVIOUR

$("saleStatus").addEventListener("change", () => {
  if ($("saleStatus").value === "no") {
    $("saleCount").value = 0;
  } else if (Number($("saleCount").value) === 0) {
    $("saleCount").value = 1;
  }
});

$("saleCount").addEventListener("input", () => {
  const count = Number($("saleCount").value);

  $("saleStatus").value = count > 0 ? "yes" : "no";
});

// SAVE OR UPDATE DAILY ENTRY

$("saleForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentUser) {
    showToast("Please sign in first.");
    return;
  }

  const day = Number($("dayNumber").value);
  const date = $("saleDate").value;
  const status = $("saleStatus").value;
  const count = Number($("saleCount").value);

  if (!date) {
    showToast("Please select a date.");
    return;
  }

  if (!Number.isInteger(day) || day < 1 || day > 45) {
    showToast("Select a day between 1 and 45.");
    return;
  }

  if (!Number.isInteger(count) || count < 0 || count > 999) {
    showToast("Enter a valid number of sales.");
    return;
  }

  if (status === "yes" && count < 1) {
    showToast("Enter at least one sale, or choose No sale.");
    return;
  }

  if (status === "no" && count !== 0) {
    showToast("No sale must have a count of zero.");
    return;
  }

  const entries = getEntries();

  const entry = {
    day: day,
    date: date,
    line: $("line").value,
    status: status,
    sales: status === "yes" ? count : 0,
    notes: $("notes").value.trim(),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = entries.findIndex((item) => Number(item.day) === day);

  if (existingIndex !== -1) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }

  if (!saveEntries(entries)) return;

  showToast(
    existingIndex !== -1
      ? `Day ${day} updated successfully.`
      : `Day ${day} saved successfully.`,
  );

  cancelEdit();
  render();
});

// CANCEL EDIT

function cancelEdit() {
  editingDay = null;

  if (!$("saleForm")) return;

  $("saleForm").reset();

  $("saleDate").value = localDateString();
  $("dayNumber").value = "1";
  $("saleCount").value = "1";
  $("saleStatus").value = "yes";

  $("formTitle").textContent = "Add daily entry";
  $("saveBtn").textContent = "Save daily entry";
  $("cancelEdit").hidden = true;
}

$("cancelEdit").addEventListener("click", cancelEdit);

// EDIT ENTRY

function editEntry(day) {
  const entry = getEntries().find((item) => Number(item.day) === Number(day));

  if (!entry) return;

  editingDay = Number(day);

  $("saleDate").value = entry.date || localDateString();
  $("dayNumber").value = String(entry.day);
  $("line").value = entry.line || "";
  $("saleStatus").value = entry.status || "no";
  $("saleCount").value = Number(entry.sales) || 0;
  $("notes").value = entry.notes || "";

  $("formTitle").textContent = `Edit Day ${day}`;
  $("saveBtn").textContent = "Update entry";
  $("cancelEdit").hidden = false;

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// DELETE ENTRY

function deleteEntry(day) {
  const confirmed = confirm(`Delete the entry for Day ${day}?`);

  if (!confirmed) return;

  const entries = getEntries().filter(
    (item) => Number(item.day) !== Number(day),
  );

  if (!saveEntries(entries)) return;

  if (editingDay === Number(day)) {
    cancelEdit();
  }

  render();
  showToast("Entry deleted.");
}

// SAFE HTML TEXT

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

// FORMAT DATE

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value + "T12:00:00");

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// TOAST MESSAGE

function showToast(message) {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.style.display = "block";

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.style.display = "none";
  }, 2500);
}

// DASHBOARD + TABLE

function render() {
  if (!currentUser) return;

  const entries = getEntries().sort((a, b) => Number(a.day) - Number(b.day));

  const totalSales = entries.reduce(
    (sum, entry) => sum + (Number(entry.sales) || 0),
    0,
  );

  const salesDays = entries.filter((entry) => Number(entry.sales) > 0).length;

  const daysLogged = entries.length;

  $("totalSales").textContent = totalSales;
  $("daysLogged").textContent = `${daysLogged} / 45`;
  $("salesDays").textContent = salesDays;

  $("dailyAvg").textContent = daysLogged
    ? (totalSales / daysLogged).toFixed(1)
    : "0";

  $("progressText").textContent = `${daysLogged} of 45 days`;

  $("progressFill").style.width = `${(daysLogged / 45) * 100}%`;

  $("remainingDays").textContent = Math.max(0, 45 - daysLogged);

  const filter = $("filterLine").value;

  const shownEntries = entries
    .filter((entry) => filter === "all" || entry.line === filter)
    .sort((a, b) => Number(b.day) - Number(a.day));

  const tbody = $("entriesBody");
  tbody.innerHTML = "";

  shownEntries.forEach((entry) => {
    const tr = document.createElement("tr");

    const note = entry.notes
      ? `<div class="note">${escapeHtml(entry.notes)}</div>`
      : "";

    tr.innerHTML = `
      <td>
        <span class="day-chip">D${Number(entry.day)}</span>
        <div class="date-text">${formatDate(entry.date)}</div>
      </td>
      <td>
        <strong>${escapeHtml(entry.line || "")}</strong>
        ${note}
      </td>
      <td><strong>${Number(entry.sales) || 0}</strong></td>
      <td>
        <span class="sale-pill ${
          Number(entry.sales) > 0 ? "sale-yes" : "sale-no"
        }">
          ${Number(entry.sales) > 0 ? "SALE" : "NO SALE"}
        </span>
      </td>
      <td>
        <button class="action-btn"
          data-edit="${Number(entry.day)}"
          aria-label="Edit Day ${Number(entry.day)}"
          title="Edit">✎</button>
        <button class="action-btn delete"
          data-delete="${Number(entry.day)}"
          aria-label="Delete Day ${Number(entry.day)}"
          title="Delete">×</button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  $("emptyState").hidden = shownEntries.length > 0;

  tbody.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editEntry(Number(button.dataset.edit));
    });
  });

  tbody.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteEntry(Number(button.dataset.delete));
    });
  });
}

$("filterLine").addEventListener("change", render);

// RESTORE SESSION

function restoreSession() {
  let savedSession = null;

  try {
    savedSession = sessionStorage.getItem(SESSION_KEY);
  } catch (error) {
    console.error("Unable to restore session:", error);
  }

  const users = readUsers();

  if (savedSession && users[savedSession]) {
    login(savedSession, users[savedSession]);
  } else {
    currentUser = null;
    $("app").hidden = true;
    $("auth").hidden = false;
    setMode("login");
  }
}

restoreSession();
