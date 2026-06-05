/* ============================================================
   Codex LED Widget — Renderer Logic
   ============================================================ */

// ---- i18n ---- //
const I18N = {
  zh: {
    title:           "Codex 额度",
    loading:         "读取中",
    remaining:       "剩余",
    labelPrimary:    "5小时",
    labelSecondary:  "7天",
    labelPlan:       "计划",
    statusReady:     "额度已更新",
    statusError:     "获取额度失败",
    btnPinOn:        "取消置顶",
    btnPinOff:       "置顶",
    unknownPlan:     "未知",
    refreshTooltip:  "刷新",
    hideTooltip:     "隐藏",
    quitTooltip:     "退出",
    // reset / expiry time
    resetting:       "重置中",
    inMin:           "{n}分钟后到期",
    expiresAt:       "到期 {t}",
    expiresTomorrow: "明天 {t}到期",
    expiresDays:     "{n}天后 {t}到期",
  },
  en: {
    title:           "Codex Quota",
    loading:         "Loading",
    remaining:       "Remaining",
    labelPrimary:    "5-hour",
    labelSecondary:  "7-day",
    labelPlan:       "Plan",
    statusReady:     "Quota updated",
    statusError:     "Failed to fetch quota",
    btnPinOn:        "Unpin",
    btnPinOff:       "Pin",
    homePlan:        "Free",
    proPlan:         "Pro",
    maxPlan:         "Max",
    unknownPlan:     "Unknown",
    refreshTooltip:  "Refresh",
    hideTooltip:     "Hide",
    quitTooltip:     "Quit",
    // reset / expiry time
    resetting:       "Resetting…",
    inMin:           "{n} min left",
    expiresAt:       "Expires {t}",
    expiresTomorrow: "Tomorrow {t}",
    expiresDays:     "{n}d {t}",
  },
};

let currentLang = "zh";

function getText(key) {
  return I18N[currentLang][key] || key;
}

// ---- DOM refs ---- //
const $ = (id) => document.getElementById(id);
const dom = {
  body:         document.body,
  brandName:    $("brandName"),
  stateText:    $("stateText"),
  trafficLight: $("trafficLight"),
  remaining:    $("remaining"),
  liquidFill:   $("liquidFill"),
  langBtn:      $("langBtn"),
  pinBtn:       $("pinBtn"),
  refreshBtn:   $("refreshBtn"),
  minimizeBtn:  $("minimizeBtn"),
  closeBtn:       $("closeBtn"),
  primaryLabel:   $("primaryLabel"),
  primaryText:    $("primaryText"),
  primaryReset:   $("primaryReset"),
  secondaryLabel: $("secondaryLabel"),
  secondaryText:  $("secondaryText"),
  secondaryReset: $("secondaryReset"),
  planLabel:      $("planLabel"),
  planText:       $("planText"),
  deepseekText:   $("deepseekText"),
  deepseekSpend:  $("deepseekSpend"),
};

// ---- State ---- //
let isAlwaysOnTop = true;

// ---- Helpers ---- //
function setBodyState(state) {
  dom.body.setAttribute("data-state", state);
}

function setTrafficLight(color) {
  dom.trafficLight.className = "traffic-light " + color;
  // update liquid fill colour
  dom.liquidFill.className = "liquid-fill " + color;
}

// ---- Apply Language ---- //
function applyLanguage() {
  dom.brandName.textContent      = getText("title");
  dom.stateText.textContent      = getText("loading");
  dom.primaryLabel.textContent   = getText("labelPrimary");
  dom.secondaryLabel.textContent = getText("labelSecondary");
  dom.planLabel.textContent      = getText("labelPlan");
  dom.langBtn.textContent        = currentLang === "zh" ? "EN" : "中";

  // Update button titles
  dom.pinBtn.title      = isAlwaysOnTop ? getText("btnPinOn") : getText("btnPinOff");
  dom.pinBtn.ariaLabel  = dom.pinBtn.title;
  dom.refreshBtn.title  = getText("refreshTooltip");
  dom.minimizeBtn.title = getText("hideTooltip");
  dom.closeBtn.title    = getText("quitTooltip");

  // Update quota cards if data exists
  const data = dom.body.dataset;
  if (data.remainingPercent !== undefined) {
    applyQuotaCards(data);
  }
}

// ---- Toggle Language ---- //
function toggleLang() {
  currentLang = currentLang === "zh" ? "en" : "zh";
  applyLanguage();
}

// ---- Pin / Unpin ---- //
function togglePin() {
  const newVal = !isAlwaysOnTop;
  window.codexQuota.setAlwaysOnTop(newVal);
  // The main process sends back the change via onAlwaysOnTopChanged
}

// ---- Refresh ---- //
async function fetchQuota() {
  setBodyState("loading");
  setTrafficLight("loading");
  dom.stateText.textContent    = getText("loading");

  let data;
  try {
    data = await window.codexQuota.getQuota();
  } catch (err) {
    console.error("fetchQuota error:", err);
    setBodyState("error");
    setTrafficLight("red");
      dom.stateText.textContent  = getText("statusError");
    dom.remaining.textContent  = "--%";
    dom.primaryText.textContent   = "--";
    dom.secondaryText.textContent = "--";
    dom.planText.textContent      = "--";
    dom.liquidFill.style.height   = "0%";
    return;
  }

  // Store data for language switch
  dom.body.dataset.remainingPercent = data.remainingPercent;
  dom.body.dataset.planType = data.planType || "unknown";

  // Calculate driving values
  const remPct = data.remainingPercent ?? 0;
  const usedPct = data.usedPercent ?? (100 - remPct);

  // --- Update traffic light --- //
  let ledColor;
  if (remPct >= 10) {
    ledColor = "green";
  } else if (remPct > 0) {
    ledColor = "yellow";
  } else {
    ledColor = "red";
  }
  setTrafficLight(ledColor);

  // --- Update liquid fill --- //
  dom.liquidFill.style.height = remPct + "%";

  // --- Update meter text --- //
  dom.remaining.textContent = remPct + "%";

  // --- Update quota cards --- //
  window._quotaData = data;
  applyQuotaCards(data);

  // --- Status --- //
  setBodyState("ready");
  dom.stateText.textContent  = getText("statusReady");
}

// ---- DeepSeek Balance ---- //
// ---- DeepSeek daily tracking (file-based, persists across restarts) ---- //
function getTodayKey() {
  return new Date().toDateString();
}

async function getDailyOpening() {
  try {
    const data = await window.codexQuota.getDailyData();
    if (data && data.date === getTodayKey()) {
      return data.opening;
    }
  } catch (_) { /* ignore */ }
  return null;
}

async function setDailyOpening(balance) {
  await window.codexQuota.setDailyData({
    date: getTodayKey(),
    opening: balance
  });
}

async function calcTodaySpend(currentBalance) {
  const opening = await getDailyOpening();
  if (opening !== null) {
    return Math.max(0, opening - currentBalance);
  }
  // First fetch today: record opening, spend = 0
  await setDailyOpening(currentBalance);
  return 0;
}

async function fetchDeepSeekBalance() {
  try {
    const result = await window.codexQuota.getDeepSeekBalance();
    if (result && result.balance != null) {
      const bal = Number(result.balance);
      const currency = result.currency || "CNY";
      const spent = await calcTodaySpend(bal);

      dom.deepseekText.textContent =
        "DeepSeek 剩余额度 " + bal.toFixed(2) + " [" + currency + "]";
      dom.deepseekSpend.textContent =
        "今日消耗 " + spent.toFixed(2);
    } else {
      dom.deepseekText.textContent = "DeepSeek --";
      dom.deepseekSpend.textContent = "今日消耗 --";
    }
  } catch (err) {
    console.error("DeepSeek balance error:", err);
    dom.deepseekText.textContent = "DeepSeek --";
    dom.deepseekSpend.textContent = "今日消耗 --";
  }
}

// ---- Format reset/expiry time ---- //
function formatResetTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();

    if (diffMs <= 0) return getText("resetting");

    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 60) return getText("inMin").replace("{n}", diffMin);

    const diffHrs = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;

    // same day: show "到期 HH:mm"
    if (d.toDateString() === now.toDateString()) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return getText("expiresAt").replace("{t}", `${hh}:${mm}`);
    }

    // tomorrow: show "明天 HH:mm"
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return getText("expiresTomorrow").replace("{t}", `${hh}:${mm}`);
    }

    // future days: show "N天 HH:mm"
    const diffDays = Math.floor(diffMs / 86400000);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return getText("expiresDays").replace("{n}", diffDays).replace("{t}", `${hh}:${mm}`);
  } catch {
    return "";
  }
}

function applyQuotaCards(data) {
  const pct = data.remainingPercent ?? 0;
  dom.remaining.textContent = pct + "%";

  const primary = data.primary;
  const secondary = data.secondary;

  if (primary) {
    const used = primary.usedPercent != null ? primary.usedPercent + "%" : "--";
    const rem  = primary.remainingPercent != null ? primary.remainingPercent + "%" : "--";
    dom.primaryText.textContent = `${used} / ${rem}`;
    dom.primaryReset.textContent = formatResetTime(primary.resetsAt);
  } else {
    dom.primaryText.textContent = "--";
    dom.primaryReset.textContent = "";
  }

  if (secondary) {
    const used = secondary.usedPercent != null ? secondary.usedPercent + "%" : "--";
    const rem  = secondary.remainingPercent != null ? secondary.remainingPercent + "%" : "--";
    dom.secondaryText.textContent = `${used} / ${rem}`;
    dom.secondaryReset.textContent = formatResetTime(secondary.resetsAt);
  } else {
    dom.secondaryText.textContent = "--";
    dom.secondaryReset.textContent = "";
  }

  // Plan type
  const planRaw = (data.planType || "").toLowerCase();
  if (planRaw.includes("max") || planRaw === "max") {
    dom.planText.textContent = getText("maxPlan");
  } else if (planRaw.includes("pro") || planRaw === "pro") {
    dom.planText.textContent = getText("proPlan");
  } else if (planRaw.includes("free") || planRaw.includes("home") || planRaw === "home") {
    dom.planText.textContent = getText("homePlan");
  } else if (planRaw && planRaw !== "unknown") {
    dom.planText.textContent = planRaw;
  } else {
    dom.planText.textContent = getText("unknownPlan");
  }

  // Pin-button language update
  dom.pinBtn.title      = isAlwaysOnTop ? getText("btnPinOn") : getText("btnPinOff");
  dom.pinBtn.ariaLabel  = dom.pinBtn.title;
}

// ---- Init App ---- //
async function init() {
  // Get initial always-on-top state
  try {
    isAlwaysOnTop = await window.codexQuota.getAlwaysOnTop();
  } catch (_) { /* ignore */ }
  dom.pinBtn.classList.toggle("active", isAlwaysOnTop);

  // Apply language
  applyLanguage();

  // --- Wire events --- //
  dom.langBtn.addEventListener("click", toggleLang);
  dom.pinBtn.addEventListener("click", togglePin);
  dom.refreshBtn.addEventListener("click", fetchQuota);
  $("dsRefreshBtn").addEventListener("click", fetchDeepSeekBalance);
  dom.minimizeBtn.addEventListener("click", () => window.codexQuota.minimize());
  dom.closeBtn.addEventListener("click", () => window.codexQuota.close());

  // Listen for main-process refresh signal
  window.codexQuota.onRefresh(() => {
    fetchQuota();
  });

  // Listen for always-on-top changes from main process
  window.codexQuota.onAlwaysOnTopChanged((value) => {
    isAlwaysOnTop = value;
    dom.pinBtn.classList.toggle("active", isAlwaysOnTop);
    dom.pinBtn.title      = isAlwaysOnTop ? getText("btnPinOn") : getText("btnPinOff");
    dom.pinBtn.ariaLabel  = dom.pinBtn.title;
  });

  // --- Initial fetch --- //
  fetchQuota();
  fetchDeepSeekBalance();

  // Auto-refresh every 5 minutes
  setInterval(fetchQuota, 5 * 60 * 1000);
  setInterval(fetchDeepSeekBalance, 10 * 60 * 1000);
}

// ---- Boot ---- //
document.addEventListener("DOMContentLoaded", init);
