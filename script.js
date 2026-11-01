"use strict";

// ==========================================
// MEDICARE SALES & BONUS TRACKER
// Complete JavaScript
// ==========================================

const $ = (id) => document.getElementById(id);

let mode = "login";
let currentUser = null;
let editingDate = null;
let toastTimer = null;

const USERS_KEY = "medicare_tracker_users_v2";
const SESSION_KEY = "medicare_tracker_session_v2";

const LINES = ["D1", "D2", "D3", "D4", "D5", "HI", "HI2", "HI3", "Others"];

const WEEKLY_BONUS_TIERS = [
  { sales: 10, bonus: 8000 },
  { sales: 15, bonus: 12000 },
  { sales: 20, bonus: 20000 },
  { sales: 25, bonus: 25000 },
  { sales: 30, bonus: 30000 },
  { sales: 35, bonus: 35000 },
  { sales: 40, bonus: 40000 },
  { sales: 45, bonus: 45000 },
  { sales: 50, bonus: 75000 },
];

// ==========================================
// BASIC HELPERS
// ==========================================

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function dataKey(email) {
  return "medicare_tracker_data_v2_" + normalizeEmail(email);
}

function readUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
    return users && typeof users === "object" ? users : {};
  } catch {
    return {};
  }
}

function getEntries() {
  if (!currentUser) return [];

  try {
    const entries = JSON.parse(
      localStorage.getItem(dataKey(currentUser)) || "[]",
    );

    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  try {
    localStorage.setItem(dataKey(currentUser), JSON.stringify(entries));

    return true;
  } catch (error) {
    showToast("Could not save. Browser storage may be full.");
    return false;
  }
}

function formatPKR(amount) {
  return "Rs. " + (Number(amount) || 0).toLocaleString("en-PK");
}

function calculateDailyBonus(sales) {
  sales = Math.max(0, Number(sales) || 0);

  return sales >= 2 ? sales * 1000 : 0;
}

function calculateWeeklyBonus(sales) {
  let bonus = 0;

  WEEKLY_BONUS_TIERS.forEach((tier) => {
    if (sales >= tier.sales) {
      bonus = tier.bonus;
    }
  });

  return bonus;
}

// ==========================================
// DATE HELPERS
// ==========================================

function getDateParts(value) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day, 12);
}

function localDateString() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function weekdayName(value) {
  return getDateParts(value).toLocaleDateString("en-US", {
    weekday: "long",
  });
}

function weekStart(value) {
  const date = getDateParts(value);

  // Monday = first day of week
  const day = (date.getDay() + 6) % 7;

  date.setDate(date.getDate() - day);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(value, amount) {
  const date = getDateParts(value);

  date.setDate(date.getDate() + amount);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value) {
  if (!value) return "—";

  return getDateParts(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRange(start) {
  return `${formatDate(start)} – ${formatDate(addDays(start, 6))}`;
}

// ==========================================
// WEEKLY SALES CALCULATION
// ==========================================

function getWeeklyStats(entries) {
  const weeks = {};

  entries.forEach((entry) => {
    if (!entry.date) return;

    const monday = weekStart(entry.date);

    if (!weeks[monday]) {
      weeks[monday] = {
        start: monday,
        sales: 0,
        entries: [],
        bonus: 0,
      };
    }

    const sales = Math.max(0, Number(entry.sales) || 0);

    if (entry.activity !== "off") {
      weeks[monday].sales += sales;
    }

    weeks[monday].entries.push(entry);
  });

  Object.values(weeks).forEach((week) => {
    week.bonus = calculateWeeklyBonus(week.sales);
  });

  return weeks;
}

// Current week Monday to Sunday
function getCurrentWeekSales(entries) {
  const today = localDateString();

  const monday = weekStart(today);
  const nextMonday = addDays(monday, 7);

  return entries.reduce((total, entry) => {
    if (!entry.date || entry.activity === "off") {
      return total;
    }

    if (entry.date >= monday && entry.date < nextMonday) {
      return total + Math.max(0, Number(entry.sales) || 0);
    }

    return total;
  }, 0);
}

// Find next weekly target
function getNextTier(sales) {
  return WEEKLY_BONUS_TIERS.find((tier) => sales < tier.sales) || null;
}

// ==========================================
// BONUS TOTALS
// ==========================================

function dailyBonusTotal(entries) {
  return entries.reduce((total, entry) => {
    return total + calculateDailyBonus(entry.sales);
  }, 0);
}

function weeklyBonusTotal(stats) {
  return Object.values(stats).reduce((total, week) => {
    return total + week.bonus;
  }, 0);
}

// ==========================================
// CAMPAIGN LINE SELECTION
// ==========================================

function selectedLines() {
  return [...document.querySelectorAll('input[name="lines"]:checked')].map(
    (input) => input.value,
  );
}

function setSelectedLines(lines) {
  document.querySelectorAll('input[name="lines"]').forEach((input) => {
    input.checked = (lines || []).includes(input.value);
  });
}

// ==========================================
// TOAST MESSAGE
// ==========================================

function showToast(message) {
  const element = $("toast");

  if (!element) return;

  element.textContent = message;
  element.style.display = "block";

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    element.style.display = "none";
  }, 2600);
}

// ==========================================
// HTML SECURITY
// ==========================================

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
}

// ==========================================
// AUTHENTICATION
// ==========================================

function setMode(next) {
  mode = next;

  $("authTitle").textContent =
    mode === "login" ? "Welcome back" : "Create your account";

  $("authSub").textContent =
    mode === "login"
      ? "Sign in to manage your sales activity and bonuses."
      : "Create an account to track daily activity.";

  $("nameField").hidden = mode !== "register";

  $("fullName").required = mode === "register";

  $("authSubmit").textContent = mode === "login" ? "Sign in" : "Create account";

  $("switchText").textContent =
    mode === "login" ? "New here?" : "Already have an account?";

  $("switchMode").textContent =
    mode === "login" ? "Create an account" : "Sign in";

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
      name,
      password,
    };

    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch {
      $("authError").textContent = "Could not save account in this browser.";
      return;
    }

    login(email, users[email]);
  } else {
    if (!users[email] || users[email].password !== password) {
      $("authError").textContent =
        "Incorrect email or password, or account not registered in this browser.";
      return;
    }

    login(email, users[email]);
  }
});

function login(email, user) {
  currentUser = normalizeEmail(email);

  try {
    sessionStorage.setItem(SESSION_KEY, currentUser);
  } catch {}

  $("auth").hidden = true;
  $("app").hidden = false;

  $("userName").textContent = user.name || currentUser;

  resetForm();
  render();
}

function logout() {
  currentUser = null;

  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}

  $("app").hidden = true;
  $("auth").hidden = false;

  $("authForm").reset();

  resetForm();
  setMode("login");
}

$("logout").addEventListener("click", logout);

// ==========================================
// ACTIVITY FORM
// ==========================================

function updateWeekdayPreview() {
  const date = $("saleDate").value;

  $("weekdayPreview").textContent = date
    ? `${weekdayName(date)} · Date-based activity`
    : "Select a date to see the weekday.";
}

function updateActivityFields() {
  const off = $("activityType").value === "off";

  $("lineField").hidden = off;
  $("salesField").hidden = off;
  $("bonusPreview").hidden = off;

  $("saleCount").required = !off;

  if (off) {
    $("saleCount").value = "0";
    setSelectedLines([]);
  } else if (Number($("saleCount").value) === 0) {
    $("saleCount").value = "1";
  }

  updateBonusPreview();
}

function updateBonusPreview() {
  const count = Math.max(0, Number($("saleCount").value) || 0);

  $("entryBonusPreview").textContent = formatPKR(calculateDailyBonus(count));
}

$("saleDate").addEventListener("change", updateWeekdayPreview);

$("activityType").addEventListener("change", updateActivityFields);

$("saleCount").addEventListener("input", updateBonusPreview);

function resetForm() {
  editingDate = null;

  $("saleForm").reset();

  $("saleDate").value = localDateString();
  $("activityType").value = "working";
  $("saleCount").value = "1";

  setSelectedLines([]);

  $("formTitle").textContent = "Add daily activity";
  $("saveBtn").textContent = "Save activity";
  $("cancelEdit").hidden = true;

  updateWeekdayPreview();
  updateActivityFields();
  updateBonusPreview();
}

// ==========================================
// SAVE ACTIVITY
// ==========================================

$("saleForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const date = $("saleDate").value;
  const activity = $("activityType").value;

  const off = activity === "off";

  const sales = off ? 0 : Number($("saleCount").value);

  const lines = off ? [] : selectedLines();

  if (!date) {
    showToast("Please select a date.");
    return;
  }

  if (!off && (!Number.isInteger(sales) || sales < 0 || sales > 999)) {
    showToast("Enter a valid whole number of sales.");
    return;
  }

  if (!off && lines.length === 0) {
    showToast("Select at least one campaign / transfer line.");
    return;
  }

  const entries = getEntries();

  const record = {
    date,
    weekday: weekdayName(date),
    activity,
    lines,
    sales,
    notes: $("notes").value.trim(),
    updatedAt: new Date().toISOString(),
  };

  // One record per date.
  // Editing the same date updates its existing record.

  const index = entries.findIndex((entry) => entry.date === date);

  if (index >= 0) {
    entries[index] = record;
  } else {
    entries.push(record);
  }

  if (!saveEntries(entries)) return;

  showToast(
    index >= 0
      ? "Date updated. Weekly sales recalculated."
      : "Activity saved. Weekly sales recalculated.",
  );

  resetForm();
  render();
});

// ==========================================
// EDIT / DELETE
// ==========================================

function cancelEdit() {
  resetForm();
}

$("cancelEdit").addEventListener("click", cancelEdit);

function editEntry(date) {
  const entry = getEntries().find((item) => item.date === date);

  if (!entry) return;

  editingDate = date;

  $("saleDate").value = entry.date;
  $("activityType").value = entry.activity || "working";

  setSelectedLines(entry.lines || (entry.line ? [entry.line] : []));

  $("saleCount").value = String(entry.sales ?? 0);
  $("notes").value = entry.notes || "";

  $("formTitle").textContent = `Edit ${formatDate(date)}`;
  $("saveBtn").textContent = "Update activity";
  $("cancelEdit").hidden = false;

  updateWeekdayPreview();
  updateActivityFields();
  updateBonusPreview();

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function deleteEntry(date) {
  if (!confirm(`Delete activity for ${formatDate(date)}?`)) {
    return;
  }

  const entries = getEntries().filter((entry) => entry.date !== date);

  if (!saveEntries(entries)) return;

  if (editingDate === date) {
    resetForm();
  }

  render();

  showToast("Activity deleted. Bonuses recalculated.");
}

// ==========================================
// WEEKLY HISTORY
// ==========================================

function renderWeeklyBreakdown(stats) {
  const tbody = $("weeklyBody");

  tbody.innerHTML = "";

  const keys = Object.keys(stats).sort().reverse();

  if (!keys.length) {
    tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty">
                    Weekly data will appear when you add activity.
                </td>
            </tr>
        `;
    return;
  }

  keys.forEach((key, index) => {
    const week = stats[key];

    const next = getNextTier(week.sales);
    const hit = week.sales >= 10;

    const target = next
      ? `${next.sales} sales · ${next.sales - week.sales} to go`
      : "All bonus tiers achieved";

    const tr = document.createElement("tr");

    if (hit) {
      tr.className = "week-hit-row";
    }

    tr.innerHTML = `
            <td>
                <strong>Week ${keys.length - index}</strong>
            </td>

            <td>${formatRange(key)}</td>

            <td>
                <strong>${week.sales}</strong>
            </td>

            <td>${target}</td>

            <td>
                <strong>${formatPKR(week.bonus)}</strong>
            </td>

            <td>
                <span class="status-pill ${hit ? "hit" : ""}">
                    ${hit ? "🏆 TARGET HIT" : "IN PROGRESS"}
                </span>
            </td>
        `;

    tbody.appendChild(tr);
  });
}

// ==========================================
// BONUS TIERS DISPLAY
// ==========================================

function renderTiers() {
  $("tierGrid").innerHTML = "";

  WEEKLY_BONUS_TIERS.forEach((tier) => {
    const div = document.createElement("div");

    div.className = "tier-item";

    div.innerHTML = `
            <span>${tier.sales}+ weekly sales</span>
            <strong>${formatPKR(tier.bonus)}</strong>
        `;

    $("tierGrid").appendChild(div);
  });
}

// ==========================================
// MAIN RENDER
// ==========================================

function render() {
  if (!currentUser) return;

  const entries = getEntries().sort((a, b) => a.date.localeCompare(b.date));

  // TOTAL SALES
  const total = entries.reduce((sum, entry) => {
    return sum + Math.max(0, Number(entry.sales) || 0);
  }, 0);

  // SALES DAYS
  const salesDays = entries.filter((entry) => {
    return entry.activity !== "off" && Number(entry.sales) > 0;
  }).length;

  // DAYS OFF
  const daysOff = entries.filter((entry) => entry.activity === "off").length;

  // WEEKLY STATISTICS
  const stats = getWeeklyStats(entries);

  // BONUS TOTALS
  const dailyBonus = dailyBonusTotal(entries);
  const weeklyBonus = weeklyBonusTotal(stats);

  // STATISTICS DISPLAY
  $("totalSales").textContent = total.toLocaleString("en-PK");
  $("salesDays").textContent = salesDays;
  $("daysOff").textContent = daysOff;

  $("dailyAvg").textContent = salesDays ? (total / salesDays).toFixed(1) : "0";

  // BONUS DISPLAY
  $("dailyBonus").textContent = formatPKR(dailyBonus);
  $("weeklyBonus").textContent = formatPKR(weeklyBonus);

  $("totalBonus").textContent = formatPKR(dailyBonus + weeklyBonus);

  // ======================================
  // CURRENT WEEK SALES
  // ======================================

  const currentWeekSales = getCurrentWeekSales(entries);

  const nextTier = getNextTier(currentWeekSales);

  const monday = weekStart(localDateString());
  const sunday = addDays(monday, 6);

  $("currentWeekSales").textContent = `${currentWeekSales} sales`;

  $("currentWeekTarget").textContent = nextTier
    ? `${nextTier.sales - currentWeekSales} more to hit ${nextTier.sales} sales`
    : "🏆 All weekly bonus tiers achieved";

  const currentWeekDates = $("currentWeekDates");

  if (currentWeekDates) {
    currentWeekDates.textContent = `${formatDate(monday)} – ${formatDate(sunday)}`;
  }

  // ======================================
  // PROGRESS
  // ======================================

  $("progressText").textContent = `${entries.length} dates recorded`;

  $("progressFill").style.width =
    `${Math.min(100, (entries.length / 45) * 100)}%`;

  $("salesDaysProgress").textContent = String(salesDays);

  // ======================================
  // FILTER ACTIVITY
  // ======================================

  const filter = $("filterLine").value;

  const rows = entries
    .filter((entry) => {
      if (filter === "all") return true;

      const lines = entry.lines || (entry.line ? [entry.line] : []);

      return lines.includes(filter);
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const body = $("entriesBody");

  body.innerHTML = "";

  rows.forEach((entry) => {
    const lines = entry.lines || (entry.line ? [entry.line] : []);

    const off = entry.activity === "off";

    const sales = Math.max(0, Number(entry.sales) || 0);

    const bonus = calculateDailyBonus(sales);

    const key = weekStart(entry.date);

    const hit = (stats[key]?.sales || 0) >= 10;

    const tr = document.createElement("tr");

    tr.className = `activity-row${hit ? " week-hit" : ""}${off ? " day-off" : ""}`;

    const lineHtml = off
      ? `<span class="activity-pill off-pill">DAY OFF</span>`
      : `
                <div class="line-tags">
                    ${lines
                      .map(
                        (line) => `
                        <span class="line-tag">
                            ${escapeHtml(line)}
                        </span>
                    `,
                      )
                      .join("")}
                </div>
            `;

    const note = entry.notes
      ? `<div class="note">${escapeHtml(entry.notes)}</div>`
      : "";

    tr.innerHTML = `
            <td>
                <div class="date-main">
                    ${formatDate(entry.date)}
                </div>

                <div class="weekday">
                    ${escapeHtml(entry.weekday || weekdayName(entry.date))}
                </div>
            </td>

            <td>
                ${lineHtml}
                ${note}
            </td>

            <td>
                <strong>${off ? "—" : sales}</strong>
            </td>

            <td>
                <strong class="bonus-amount">
                    ${off ? "—" : formatPKR(bonus)}
                </strong>
            </td>

            <td>
                <span class="result-pill ${
                  off ? "off-pill" : sales > 0 ? "sale-yes" : "sale-no"
                }">
                    ${off ? "DAY OFF" : sales > 0 ? "SALE" : "NO SALE"}
                </span>
            </td>

            <td class="action-cell">

                ${
                  hit
                    ? '<span class="trophy" title="Weekly target achieved">🏆</span>'
                    : ""
                }

                <button
                    class="action-btn"
                    data-edit="${escapeHtml(entry.date)}"
                    title="Edit"
                    aria-label="Edit entry"
                    type="button"
                >✎</button>

                <button
                    class="action-btn delete"
                    data-delete="${escapeHtml(entry.date)}"
                    title="Delete"
                    aria-label="Delete entry"
                    type="button"
                >×</button>

            </td>
        `;

    body.appendChild(tr);
  });

  // EMPTY STATE
  $("emptyState").hidden = rows.length > 0;

  // EDIT BUTTONS
  body.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editEntry(button.dataset.edit);
    });
  });

  // DELETE BUTTONS
  body.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteEntry(button.dataset.delete);
    });
  });

  // WEEKLY HISTORY
  renderWeeklyBreakdown(stats);

  // BONUS TIERS
  renderTiers();
}

// ==========================================
// FILTER EVENT
// ==========================================

$("filterLine").addEventListener("change", render);

// ==========================================
// RESTORE SESSION
// ==========================================

function restoreSession() {
  let saved = null;

  try {
    saved = sessionStorage.getItem(SESSION_KEY);
  } catch {}

  const users = readUsers();

  if (saved && users[saved]) {
    login(saved, users[saved]);
  } else {
    currentUser = null;

    $("auth").hidden = false;
    $("app").hidden = true;

    setMode("login");
  }
}

// ==========================================
// START APPLICATION
// ==========================================

restoreSession();
