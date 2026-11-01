"use strict";

// ========================================
// MEDICARE SALES TRACKER
// ========================================

const $ = (id) => document.getElementById(id);

let mode = "login";
let currentUser = null;
let editingDate = null;
let toastTimer = null;

const USERS_KEY = "medicare_tracker_users_v2";
const SESSION_KEY = "medicare_tracker_session_v2";
const FORTY_FIVE_START_KEY = "medicare_tracker_45_day_start_v1_";

// ========================================
// BONUS TIERS
// ========================================

// Daily: 2 sales or more are required.
const DAILY_BONUS_TIERS = [
  { sales: 2, bonus: 2000 },
  { sales: 4, bonus: 4000 },
  { sales: 6, bonus: 6000 },
  { sales: 8, bonus: 8000 },
  { sales: 10, bonus: 15000 },
  { sales: 12, bonus: 20000 },
];

// Weekly: Monday to Sunday.
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

// 45 calendar days only.
const FORTY_FIVE_DAY_TIERS = [
  { sales: 20, bonus: 100000 },
  { sales: 30, bonus: 150000 },
  { sales: 40, bonus: 200000 },
  { sales: 50, bonus: 250000 },
  { sales: 60, bonus: 300000 },
  { sales: 70, bonus: 350000 },
  { sales: 80, bonus: 400000 },
  { sales: 90, bonus: 450000 },
  { sales: 100, bonus: 500000 },
  { sales: 110, bonus: 550000 },
  { sales: 120, bonus: 600000 },
  { sales: 130, bonus: 650000 },
  { sales: 140, bonus: 700000 },
  { sales: 150, bonus: 750000 },
  { sales: 160, bonus: 800000 },
  { sales: 170, bonus: 850000 },
  { sales: 180, bonus: 900000 },
  { sales: 190, bonus: 950000 },
  { sales: 200, bonus: 1000000 },
  { sales: 210, bonus: 1050000 },
];

// ========================================
// STORAGE
// ========================================

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
  } catch {
    showToast("Could not save. Browser storage may be full.");
    return false;
  }
}

function formatPKR(amount) {
  return "Rs. " + (Number(amount) || 0).toLocaleString("en-PK");
}
// ========================================
// BONUS CALCULATIONS
// ========================================

function calculateTierBonus(sales, tiers) {
  sales = Math.max(0, Number(sales) || 0);

  let bonus = 0;

  tiers.forEach((tier) => {
    if (sales >= tier.sales) {
      bonus = tier.bonus;
    }
  });

  return bonus;
}

// Daily bonus: 1 sale = 0, 2+ sales = 1000 per sale.
function calculateDailyBonus(sales) {
  sales = Math.max(0, Number(sales) || 0);

  return sales >= 2 ? sales * 1000 : 0;
}

function calculateWeeklyBonus(sales) {
  return calculateTierBonus(sales, WEEKLY_BONUS_TIERS);
}

function calculateFortyFiveDayBonus(sales) {
  return calculateTierBonus(sales, FORTY_FIVE_DAY_TIERS);
}

function getNextTier(sales) {
  return WEEKLY_BONUS_TIERS.find((tier) => sales < tier.sales) || null;
}

// ========================================
// DATE HELPERS
// ========================================

function parseDate(value) {
  const parts = String(value || "")
    .split("-")
    .map(Number);

  if (
    parts.length !== 3 ||
    !parts[0] ||
    parts[1] < 1 ||
    parts[1] > 12 ||
    parts[2] < 1 ||
    parts[2] > 31
  ) {
    return null;
  }

  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));

  if (
    date.getUTCFullYear() !== parts[0] ||
    date.getUTCMonth() !== parts[1] - 1 ||
    date.getUTCDate() !== parts[2]
  ) {
    return null;
  }

  return date;
}

function dateString(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function localDateString() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(value, amount) {
  const date = parseDate(value);
  if (!date) return "";

  date.setUTCDate(date.getUTCDate() + amount);
  return dateString(date);
}

function weekdayName(value) {
  const date = parseDate(value);
  if (!date) return "";

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function weekStart(value) {
  const date = parseDate(value);
  if (!date) return null;

  const day = date.getUTCDay();
  const difference = (day + 6) % 7;

  date.setUTCDate(date.getUTCDate() - difference);

  return dateString(date);
}

function formatRange(start) {
  return `${formatDate(start)} – ${formatDate(addDays(start, 6))}`;
}

// ========================================
// DAILY BONUS TOTAL
// ========================================

function dailyBonusTotal(entries) {
  return entries.reduce((total, entry) => {
    if (entry.activity === "off") return total;

    return total + calculateDailyBonus(entry.sales);
  }, 0);
}

// ========================================
// WEEKLY SALES CALCULATION
// ========================================

function getWeeklyStats(entries) {
  const weeks = {};

  entries.forEach((entry) => {
    if (!entry.date || !parseDate(entry.date)) return;

    const monday = weekStart(entry.date);

    if (!weeks[monday]) {
      weeks[monday] = {
        start: monday,
        end: addDays(monday, 6),
        sales: 0,
        bonus: 0,
      };
    }

    if (entry.activity !== "off") {
      weeks[monday].sales += Math.max(0, Number(entry.sales) || 0);
    }
  });

  Object.values(weeks).forEach((week) => {
    week.bonus = calculateWeeklyBonus(week.sales);
  });

  return weeks;
}

function weeklyBonusTotal(stats) {
  return Object.values(stats).reduce((total, week) => total + week.bonus, 0);
}

// ========================================
// 45 DAYS CAMPAIGN
// ========================================

function getFortyFiveStartDate() {
  if (!currentUser) return "";

  try {
    return (
      localStorage.getItem(
        FORTY_FIVE_START_KEY + normalizeEmail(currentUser),
      ) || ""
    );
  } catch {
    return "";
  }
}

function saveFortyFiveStartDate(value) {
  if (!currentUser) return false;

  try {
    const key = FORTY_FIVE_START_KEY + normalizeEmail(currentUser);

    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }

    return true;
  } catch {
    showToast("Could not save campaign date.");
    return false;
  }
}

function getFortyFiveDayStats(entries, startDate) {
  if (!startDate || !parseDate(startDate)) {
    return {
      start: "",
      end: "",
      sales: 0,
      bonus: 0,
      nextTier: FORTY_FIVE_DAY_TIERS[0],
    };
  }

  // Start date is day 1. End date is day 45.
  const endDate = addDays(startDate, 44);

  let totalSales = 0;

  entries.forEach((entry) => {
    if (!entry.date || !parseDate(entry.date) || entry.activity === "off")
      return;

    if (entry.date >= startDate && entry.date <= endDate) {
      totalSales += Math.max(0, Number(entry.sales) || 0);
    }
  });

  return {
    start: startDate,
    end: endDate,
    sales: totalSales,
    bonus: calculateFortyFiveDayBonus(totalSales),
    nextTier:
      FORTY_FIVE_DAY_TIERS.find((tier) => totalSales < tier.sales) || null,
  };
}
// ========================================
// DAILY BONUS TABLE
// ========================================

function renderDailyBonusBreakdown(entries) {
  const body = $("dailyBonusBody");
  const today = localDateString();

  const todayEntry = entries.find((entry) => entry.date === today);

  const todaySales =
    todayEntry && todayEntry.activity !== "off"
      ? Math.max(0, Number(todayEntry.sales) || 0)
      : 0;

  body.innerHTML = DAILY_BONUS_TIERS.map((tier) => {
    const achieved = todaySales >= tier.sales;

    const remaining = Math.max(0, tier.sales - todaySales);

    return `
      <tr class="${achieved ? "week-hit-row" : ""}">
        <td>
          <strong>${tier.sales} sales</strong>
        </td>

        <td>
          <strong>${formatPKR(tier.bonus)}</strong>
        </td>

        <td>
          <span class="status-pill ${achieved ? "hit" : ""}">
            ${achieved ? "TARGET HIT" : `${remaining} to go`}
          </span>
        </td>
      </tr>
    `;
  }).join("");
}

// ========================================
// 45 DAYS DISPLAY
// ========================================

function renderFortyFiveDayBonus(entries) {
  const startDate = $("fortyFiveStart").value;
  const stats = getFortyFiveDayStats(entries, startDate);

  $("fortyFiveBonus").textContent = formatPKR(stats.bonus);

  if (!stats.start) {
    $("fortyFiveSales").textContent = "Choose campaign start date";
    $("fortyFiveDateRange").textContent = "Select campaign start date.";
    $("fortyFiveProgressText").textContent = "0 / 20 sales";
    $("fortyFiveProgressFill").style.width = "0%";
    $("fortyFiveNextTarget").textContent = "20 sales";

    $("fortyFiveBody").innerHTML = `
      <tr><td colspan="3" class="empty">
        Select a campaign start date.
      </td></tr>
    `;

    return 0;
  }

  const nextTier = stats.nextTier;

  const previousTier = nextTier
    ? FORTY_FIVE_DAY_TIERS[FORTY_FIVE_DAY_TIERS.indexOf(nextTier) - 1]?.sales ||
      0
    : 210;

  const progress = nextTier
    ? Math.min(
        100,
        Math.max(
          0,
          ((stats.sales - previousTier) / (nextTier.sales - previousTier)) *
            100,
        ),
      )
    : 100;

  $("fortyFiveSales").textContent = `${stats.sales} sales · 45-day campaign`;

  $("fortyFiveDateRange").textContent =
    `${formatDate(stats.start)} – ${formatDate(stats.end)}`;

  $("fortyFiveProgressText").textContent = nextTier
    ? `${stats.sales} / ${nextTier.sales} sales`
    : `${stats.sales} sales · All targets achieved`;

  $("fortyFiveProgressFill").style.width = `${progress}%`;

  $("fortyFiveNextTarget").textContent = nextTier
    ? `${nextTier.sales} sales · ${nextTier.sales - stats.sales} to go`
    : "All bonus tiers achieved";

  $("fortyFiveBody").innerHTML = FORTY_FIVE_DAY_TIERS.map((tier) => {
    const achieved = stats.sales >= tier.sales;

    return `
        <tr class="${achieved ? "week-hit-row" : ""}">
          <td><strong>${tier.sales}</strong></td>
          <td><strong>${formatPKR(tier.bonus)}</strong></td>
          <td>
            <span class="status-pill ${achieved ? "hit" : ""}">
              ${achieved ? "TARGET HIT" : `${tier.sales - stats.sales} to go`}
            </span>
          </td>
        </tr>
      `;
  }).join("");

  return stats.bonus;
}

// ========================================
// WEEKLY HISTORY
// ========================================

function renderWeeklyBreakdown(stats) {
  const tbody = $("weeklyBody");
  tbody.innerHTML = "";

  const keys = Object.keys(stats).sort().reverse();

  if (!keys.length) {
    tbody.innerHTML = `
      <tr><td colspan="6" class="empty">No weekly data yet.</td></tr>
    `;
    return;
  }

  keys.forEach((key, index) => {
    const week = stats[key];
    const next = getNextTier(week.sales);
    const hit = week.sales >= 10;

    const target = next
      ? `${next.sales} sales · ${next.sales - week.sales} to go`
      : "All targets achieved";

    const tr = document.createElement("tr");

    if (hit) tr.className = "week-hit-row";

    tr.innerHTML = `
      <td><strong>Week ${keys.length - index}</strong></td>
      <td>${formatRange(key)}</td>
      <td><strong>${week.sales}</strong></td>
      <td>${target}</td>
      <td><strong>${formatPKR(week.bonus)}</strong></td>
      <td>
        <span class="status-pill ${hit ? "hit" : ""}">
          ${hit ? "TARGET HIT" : "IN PROGRESS"}
        </span>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ========================================
// WEEKLY TARGET DISPLAY
// ========================================

function renderTiers() {
  $("tierGrid").innerHTML = WEEKLY_BONUS_TIERS.map(
    (tier) => `
    <div class="tier-item">
      <span>${tier.sales}+ weekly sales</span>
      <strong>${formatPKR(tier.bonus)}</strong>
    </div>
  `,
  ).join("");
}

// ========================================
// LINES
// ========================================

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

// ========================================
// TOAST
// ========================================

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

// ========================================
// SECURITY
// ========================================

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

// ========================================
// AUTHENTICATION
// ========================================

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
      $("authError").textContent = "Account already exists.";
      return;
    }

    users[email] = { name, password };

    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch {
      $("authError").textContent = "Could not save account.";
      return;
    }

    login(email, users[email]);
  } else {
    if (!users[email] || users[email].password !== password) {
      $("authError").textContent = "Incorrect email or password.";
      return;
    }

    login(email, users[email]);
  }
});

// ========================================
// LOGIN / LOGOUT
// ========================================

function login(email, user) {
  currentUser = normalizeEmail(email);

  try {
    sessionStorage.setItem(SESSION_KEY, currentUser);
  } catch {}

  $("auth").hidden = true;
  $("app").hidden = false;

  $("userName").textContent = user.name || currentUser;

  $("fortyFiveStart").value = getFortyFiveStartDate();

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

// ========================================
// ACTIVITY FORM
// ========================================

function updateWeekdayPreview() {
  const date = $("saleDate").value;

  $("weekdayPreview").textContent = date
    ? `${weekdayName(date)} · Date-based activity`
    : "Select a date.";
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

// ========================================
// RESET FORM
// ========================================

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

// ========================================
// SAVE ACTIVITY
// ========================================

$("saleForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentUser) return;

  const date = $("saleDate").value;
  const activity = $("activityType").value;
  const off = activity === "off";

  const sales = off ? 0 : Number($("saleCount").value);
  const lines = off ? [] : selectedLines();

  if (!date || !parseDate(date)) {
    showToast("Please select a valid date.");
    return;
  }

  if (!off && (!Number.isInteger(sales) || sales < 0 || sales > 999)) {
    showToast("Enter a valid whole number of sales.");
    return;
  }

  if (!off && lines.length === 0) {
    showToast("Select at least one campaign line.");
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

  const oldDate = editingDate;

  if (oldDate) {
    const index = entries.findIndex((entry) => entry.date === oldDate);
    if (index >= 0) entries.splice(index, 1);
  }

  const existingIndex = entries.findIndex((entry) => entry.date === date);

  if (existingIndex >= 0) {
    entries[existingIndex] = record;
  } else {
    entries.push(record);
  }

  if (!saveEntries(entries)) return;

  showToast(oldDate ? "Activity updated." : "Activity saved.");

  resetForm();
  render();
});

// ========================================
// EDIT ENTRY
// ========================================

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

  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("cancelEdit").addEventListener("click", resetForm);

// ========================================
// DELETE ENTRY
// ========================================

function deleteEntry(date) {
  if (!confirm(`Delete activity for ${formatDate(date)}?`)) return;

  const entries = getEntries().filter((entry) => entry.date !== date);

  if (!saveEntries(entries)) return;

  if (editingDate === date) resetForm();

  render();
  showToast("Activity deleted.");
}

// ========================================
// MAIN RENDER
// ========================================

function render() {
  if (!currentUser) return;

  const entries = getEntries().sort((a, b) => a.date.localeCompare(b.date));

  const total = entries.reduce((sum, entry) => {
    if (entry.activity === "off") return sum;
    return sum + Math.max(0, Number(entry.sales) || 0);
  }, 0);

  const salesDays = entries.filter(
    (entry) => entry.activity !== "off" && Number(entry.sales) > 0,
  ).length;

  const daysOff = entries.filter((entry) => entry.activity === "off").length;

  const stats = getWeeklyStats(entries);

  const dailyBonus = dailyBonusTotal(entries);
  const weeklyBonus = weeklyBonusTotal(stats);
  const fortyFiveBonus = renderFortyFiveDayBonus(entries);

  // Statistics
  $("totalSales").textContent = total.toLocaleString("en-PK");
  $("salesDays").textContent = salesDays;
  $("daysOff").textContent = daysOff;
  $("dailyAvg").textContent = salesDays ? (total / salesDays).toFixed(1) : "0";

  // Bonus totals
  $("dailyBonus").textContent = formatPKR(dailyBonus);
  $("weeklyBonus").textContent = formatPKR(weeklyBonus);

  $("totalBonus").textContent = formatPKR(
    dailyBonus + weeklyBonus + fortyFiveBonus,
  );

  // Progress
  $("progressText").textContent = `${entries.length} dates recorded`;

  $("progressFill").style.width =
    `${Math.min(100, (entries.length / 45) * 100)}%`;

  $("salesDaysProgress").textContent = String(salesDays);

  // Daily bonus breakdown
  renderDailyBonusBreakdown(entries);

  // Filter
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

    const bonus = off ? 0 : calculateDailyBonus(sales);

    const key = weekStart(entry.date);
    const hit = (stats[key]?.sales || 0) >= 10;

    const tr = document.createElement("tr");

    tr.className = `activity-row${hit ? " week-hit" : ""}${off ? " day-off" : ""}`;

    const lineHtml = off
      ? `<span class="activity-pill off-pill">DAY OFF</span>`
      : `<div class="line-tags">
          ${lines
            .map((line) => `<span class="line-tag">${escapeHtml(line)}</span>`)
            .join("")}
        </div>`;

    const note = entry.notes
      ? `<div class="note">${escapeHtml(entry.notes)}</div>`
      : "";

    tr.innerHTML = `
      <td>
        <div class="date-main">${formatDate(entry.date)}</div>
        <div class="weekday">${escapeHtml(entry.weekday || weekdayName(entry.date))}</div>
      </td>

      <td>${lineHtml}${note}</td>

      <td><strong>${off ? "—" : sales}</strong></td>

      <td><strong>${off ? "—" : formatPKR(bonus)}</strong></td>

      <td>
        <span class="result-pill ${
          off ? "off-pill" : sales > 0 ? "sale-yes" : "sale-no"
        }">
          ${off ? "DAY OFF" : sales > 0 ? "SALE" : "NO SALE"}
        </span>
      </td>

      <td class="action-cell">
        ${hit ? '<span title="Weekly target achieved">🏆</span>' : ""}
        <button class="action-btn" data-edit="${escapeHtml(entry.date)}" type="button">✎</button>
        <button class="action-btn delete" data-delete="${escapeHtml(entry.date)}" type="button">×</button>
      </td>
    `;

    body.appendChild(tr);
  });

  $("emptyState").hidden = rows.length > 0;

  body.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editEntry(button.dataset.edit));
  });

  body.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteEntry(button.dataset.delete));
  });

  renderWeeklyBreakdown(stats);
  renderTiers();
}

// ========================================
// EVENTS
// ========================================

$("filterLine").addEventListener("change", render);

$("fortyFiveStart").addEventListener("change", function () {
  const date = this.value;

  if (date && !parseDate(date)) {
    showToast("Please select a valid date.");
    return;
  }

  if (!saveFortyFiveStartDate(date)) return;

  render();
  showToast("45-day campaign updated.");
});

// ========================================
// RESTORE SESSION
// ========================================

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

// ========================================
// START
// ========================================

restoreSession();
