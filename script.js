const $ = (id) => document.getElementById(id);

let mode = "login";
let currentUser = null;
let editingDay = null;

const USERS_KEY = "medicare_tracker_users";

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
  } catch {
    return {};
  }
}

function dataKey(email) {
  return "medicare_tracker_data_" + email.toLowerCase();
}

function getEntries() {
  try {
    return JSON.parse(localStorage.getItem(dataKey(currentUser)) || "[]");
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(dataKey(currentUser), JSON.stringify(entries));
}

// LOGIN / REGISTER MODE

const USERS_KEY = "medicare_tracker_users";

function readUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");

    return users && typeof users === "object" && !Array.isArray(users)
      ? users
      : {};
  } catch (error) {
    console.error("Unable to read users:", error);
    return {};
  }
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// LOGIN / REGISTER MODE

function setMode(nextMode) {
  mode = nextMode;

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

$("authForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const email = normalizeEmail($("email").value);
  const password = $("password").value;
  const users = readUsers();

  if (!email || !password) {
    $("authError").textContent = "Please enter email and password.";
    return;
  }

  if (mode === "register") {
    const name = $("fullName").value.trim();

    if (name.length < 2) {
      $("authError").textContent = "Please enter your name.";
      return;
    }

    if (users[email]) {
      $("authError").textContent = "Account already exists. Please sign in.";
      return;
    }

    users[email] = {
      name,
      password,
    };

    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (error) {
      $("authError").textContent = "Unable to save account in this browser.";
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
      "Incorrect email or password. Check your email and password, or create an account on this browser.";
    return;
  }

  login(email, user);
});

// function setMode(nextMode) {
//   mode = nextMode;

//   $("authTitle").textContent =
//     mode === "login" ? "Welcome back" : "Create your account";

//   $("authSub").textContent =
//     mode === "login"
//       ? "Sign in to manage your 45-day sales progress."
//       : "Create an account to track your daily sales.";

//   $("nameField").hidden = mode !== "register";
//   $("fullName").required = mode === "register";

//   $("authSubmit").textContent = mode === "login" ? "Sign in" : "Create account";

//   $("switchText").textContent =
//     mode === "login" ? "New here?" : "Already have an account?";

//   $("switchMode").textContent =
//     mode === "login" ? "Create an account" : "Sign in";

//   $("password").autocomplete =
//     mode === "login" ? "current-password" : "new-password";

//   $("authError").textContent = "";
// }

// $("switchMode").addEventListener("click", () => {
//   setMode(mode === "login" ? "register" : "login");
// });

// $("authForm").addEventListener("submit", (event) => {
//   event.preventDefault();

//   const email = $("email").value.trim().toLowerCase();
//   const password = $("password").value;
//   const users = readUsers();

//   if (mode === "register") {
//     const name = $("fullName").value.trim();

//     if (name.length < 2) {
//       $("authError").textContent = "Please enter your name.";
//       return;
//     }

//     if (users[email]) {
//       $("authError").textContent = "Account already exists. Please sign in.";
//       return;
//     }

//     users[email] = {
//       name,
//       password,
//     };

//     localStorage.setItem(USERS_KEY, JSON.stringify(users));
//     login(email, users[email]);
//   } else {
//     if (!users[email] || users[email].password !== password) {
//       $("authError").textContent = "Incorrect email or password.";
//       return;
//     }

//     login(email, users[email]);
//   }
// });

// OPEN DASHBOARD

function login(email, user) {
  currentUser = email;

  sessionStorage.setItem("medicare_tracker_session", email);

  $("auth").hidden = true;
  $("app").hidden = false;
  $("userName").textContent = user.name || email;

  initializeTracker();
  render();
}

function logout() {
  currentUser = null;
  sessionStorage.removeItem("medicare_tracker_session");

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

  if (count > 0) {
    $("saleStatus").value = "yes";
  } else {
    $("saleStatus").value = "no";
  }
});

// SAVE OR UPDATE DAILY ENTRY

$("saleForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const day = Number($("dayNumber").value);
  const date = $("saleDate").value;
  const status = $("saleStatus").value;
  const count = Number($("saleCount").value);

  if (!date) {
    showToast("Please select a date.");
    return;
  }

  if (day < 1 || day > 45) {
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
    day,
    date,
    line: $("line").value,
    status,
    sales: status === "yes" ? count : 0,
    notes: $("notes").value.trim(),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = entries.findIndex((item) => item.day === day);

  if (existingIndex !== -1) {
    entries[existingIndex] = entry;
    showToast(`Day ${day} updated successfully.`);
  } else {
    entries.push(entry);
    showToast(`Day ${day} saved successfully.`);
  }

  saveEntries(entries);
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
  const entry = getEntries().find((item) => item.day === day);

  if (!entry) return;

  editingDay = day;

  $("saleDate").value = entry.date;
  $("dayNumber").value = String(entry.day);
  $("line").value = entry.line;
  $("saleStatus").value = entry.status;
  $("saleCount").value = entry.sales;
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

  const entries = getEntries().filter((item) => item.day !== day);

  saveEntries(entries);

  if (editingDay === day) {
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

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// TOAST MESSAGE

let toastTimer;

function showToast(message) {
  const toast = $("toast");

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

  const entries = getEntries().sort((a, b) => a.day - b.day);

  const totalSales = entries.reduce((sum, entry) => sum + entry.sales, 0);

  const salesDays = entries.filter((entry) => entry.sales > 0).length;

  const daysLogged = entries.length;

  $("totalSales").textContent = totalSales;
  $("daysLogged").textContent = `${daysLogged} / 45`;
  $("salesDays").textContent = salesDays;

  $("dailyAvg").textContent = daysLogged
    ? (totalSales / daysLogged).toFixed(1)
    : "0";

  $("progressText").textContent = `${daysLogged} of 45 days`;

  $("progressFill").style.width = `${(daysLogged / 45) * 100}%`;

  $("remainingDays").textContent = 45 - daysLogged;

  const filter = $("filterLine").value;

  const shownEntries = entries
    .filter((entry) => filter === "all" || entry.line === filter)
    .sort((a, b) => b.day - a.day);

  const tbody = $("entriesBody");
  tbody.innerHTML = "";

  shownEntries.forEach((entry) => {
    const tr = document.createElement("tr");

    const note = entry.notes
      ? `<div class="note">${escapeHtml(entry.notes)}</div>`
      : "";

    tr.innerHTML = `
      <td>
        <span class="day-chip">D${entry.day}</span>
        <div class="date-text">${formatDate(entry.date)}</div>
      </td>
      <td>
        <strong>${escapeHtml(entry.line)}</strong>
        ${note}
      </td>
      <td><strong>${entry.sales}</strong></td>
      <td>
        <span class="sale-pill ${entry.sales > 0 ? "sale-yes" : "sale-no"}">
          ${entry.sales > 0 ? "SALE" : "NO SALE"}
        </span>
      </td>
      <td>
        <button class="action-btn"
          data-edit="${entry.day}"
          aria-label="Edit Day ${entry.day}"
          title="Edit">✎</button>
        <button class="action-btn delete"
          data-delete="${entry.day}"
          aria-label="Delete Day ${entry.day}"
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

const savedSession = sessionStorage.getItem("medicare_tracker_session");

const users = readUsers();

if (savedSession && users[savedSession]) {
  login(savedSession, users[savedSession]);
} else {
  setMode("login");
}
