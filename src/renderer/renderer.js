/* ============================================================
   AI Quota Monitor — Renderer Logic
   ============================================================ */

// ---- i18n ---- //
const I18N = {
  zh: {
    title:           "AI额度监控",
    loading:         "读取中",
    remaining:       "剩余",
    labelPrimary:    "5小时",
    labelSecondary:  "7天",
    labelPlan:       "订阅方式",
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
    inMin:           "{n}分钟到期",
    expiresAt:       "{t}到期",
    expiresTomorrow: "明天到期",
    expiresDays:     "{n}天后到期",
    // deepseek
    dsBalance:       "DeepSeek 剩余额度 {b} [{c}]",
    dsSpend:         "今日消耗 {s}",
  },
  en: {
    title:           "AIQuotaMonitor",
    loading:         "Loading",
    remaining:       "Remaining",
    labelPrimary:    "5-hour",
    labelSecondary:  "7-day",
    labelPlan:       "Subscription",
    statusReady:     "Quota updated",
    statusError:     "Connection failed",
    btnPinOn:        "Unpin",
    btnPinOff:       "Pin",
    homePlan:        "Free",
    proPlan:         "Pro",
    maxPlan:         "Max",
    unknownPlan:     "Unknown",
    refreshTooltip:  "Refresh",
    hideTooltip:     "Hide",
    quitTooltip:     "Quit",
    // reset / expiry time (without time — matched to zh format)
    resetting:       "Resetting…",
    inMin:           "{n} min",
    expiresAt:       "{t}",
    expiresTomorrow: "Tomorrow",
    expiresDays:     "{n}d",
    // deepseek
    dsBalance:       "DeepSeek {b} [{c}]",
    dsSpend:         "Today {s}",
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
  cylinder7day:   $("cylinder7day"),
  cylinder7dayFill: $("cylinder7dayFill"),
  cylinder7dayPct: $("cylinder7dayPct"),
};

// ---- State ---- //
let isAlwaysOnTop = true;
let _refreshing = false;
let _regionVisibility = { codex: true, deepseek: true };

// ---- Region Visibility ---- //
function applyRegionVisibility(visibility) {
  _regionVisibility = visibility;
  dom.body.setAttribute("data-codex-visible", visibility.codex ? "true" : "false");
  dom.body.setAttribute("data-deepseek-visible", visibility.deepseek ? "true" : "false");
  // Report new height after CSS takes effect
  requestAnimationFrame(() => reportHeight());
}

function reportHeight() {
  const widget = document.querySelector(".widget");
  if (!widget) return;
  const h = widget.getBoundingClientRect().height;
  window.codexQuota.setHeight(Math.ceil(h)).catch(() => {});
}

// ---- Helpers ---- //
function setBodyState(state) {
  dom.body.setAttribute("data-state", state);
}

function setTrafficLight(color) {
  dom.trafficLight.className = "traffic-light " + color;
}

function setPoolsColor(remPct) {
  let color;
  if (remPct > 30) {
    color = "green";
  } else if (remPct > 10) {
    color = "yellow";
  } else {
    color = "red";
  }
  dom.liquidFill.className = "liquid-fill " + color;
  dom.cylinder7dayFill.className = "cylinder-7day-fill " + color;
}

// ---- Apply Language ---- //
function applyLanguage() {
  dom.brandName.textContent      = getText("title");
  dom.stateText.textContent      = "";
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

  // Update quota cards using cached full data
  if (window._quotaData) {
    applyQuotaCards(window._quotaData);
  }
  // Update DeepSeek text
  updateDeepSeekUI();
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
  if (_refreshing) return;
  _refreshing = true;

  setBodyState("loading");
  setTrafficLight("yellow");
  dom.stateText.textContent = "";

  // Track success per visible region; hidden regions are implicitly "ok"
  let codexOk = !_regionVisibility.codex;
  let deepseekOk = !_regionVisibility.deepseek;

  const tasks = [];

  // Codex — only fetch if visible
  if (_regionVisibility.codex) {
    tasks.push(
      (async () => {
        const data = await window.codexQuota.getQuota();

        // Store data for language switch
        dom.body.dataset.remainingPercent = data.remainingPercent;
        dom.body.dataset.planType = data.planType || "unknown";

        const remPct = data.remainingPercent ?? 0;
        setPoolsColor(remPct);

        // --- Update liquid fill --- //
        dom.liquidFill.style.height = remPct + "%";

        // --- Update meter text --- //
        dom.remaining.textContent = remPct + "%";

        // --- Update quota cards --- //
        window._quotaData = data;
        applyQuotaCards(data);

        codexOk = true;
      })().catch((err) => {
        console.error("fetchQuota error:", err);
        dom.remaining.textContent = "--%";
        dom.primaryText.textContent = "--";
        dom.secondaryText.textContent = "--";
        dom.planText.textContent = "--";
        dom.liquidFill.style.height = "0%";
        dom.liquidFill.className = "liquid-fill";
        dom.cylinder7dayFill.style.height = "0%";
        dom.cylinder7dayFill.className = "cylinder-7day-fill";
        dom.cylinder7dayPct.textContent = "--";
        window._quotaData = null;
        codexOk = false;
      })
    );
  }

  // DeepSeek — only fetch if visible
  if (_regionVisibility.deepseek) {
    tasks.push(
      fetchDeepSeekBalance().then((ok) => { deepseekOk = ok; })
    );
  }

  if (tasks.length === 0) {
    // Nothing to fetch — all regions hidden
    setBodyState("ready");
    setTrafficLight("green");
    dom.stateText.textContent = "";
    _refreshing = false;
    return;
  }

  await Promise.allSettled(tasks);

  // Traffic light: green only if ALL visible regions succeeded
  if (codexOk && deepseekOk) {
    setBodyState("ready");
    setTrafficLight("green");
  } else {
    setBodyState("error");
    setTrafficLight("red");
  }
  dom.stateText.textContent = "";

  _refreshing = false;
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
      window._dsData = { balance: bal, currency, spend: spent };
      updateDeepSeekUI();
      return true;
    } else if (!window._dsData) {
      // API returned but no balance data & we've never had it — show "--"
      dom.deepseekText.textContent = "DeepSeek --";
      dom.deepseekSpend.textContent = currentLang === "zh" ? "今日消耗 --" : "Today --";
    }
    // else: no data but we have old data — keep old values silently
    return true; // no explicit error
  } catch (err) {
    console.error("DeepSeek balance error:", err);
    if (!window._dsData) {
      dom.deepseekText.textContent = "DeepSeek --";
      dom.deepseekSpend.textContent = currentLang === "zh" ? "今日消耗 --" : "Today --";
    }
    // else: keep old values silently
    return false;
  }
}

function updateDeepSeekUI() {
  const d = window._dsData;
  if (!d) return;
  dom.deepseekText.textContent = getText("dsBalance")
    .replace("{b}", d.balance.toFixed(2))
    .replace("{c}", d.currency || "CNY");
  dom.deepseekSpend.textContent = getText("dsSpend")
    .replace("{s}", d.spend.toFixed(2));
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

    // tomorrow: show "明天到期"
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) {
      return getText("expiresTomorrow");
    }

    // future days: show "N天后到期"
    const diffDays = Math.floor(diffMs / 86400000);
    return getText("expiresDays").replace("{n}", diffDays);
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
    const rem  = primary.remainingPercent != null ? primary.remainingPercent + "%" : "--";
    dom.primaryText.textContent = rem;
    dom.primaryReset.textContent = formatResetTime(primary.resetsAt);
  } else {
    dom.primaryText.textContent = "--";
    dom.primaryReset.textContent = "";
  }

  if (secondary) {
    const remPct = secondary.remainingPercent ?? 0;
    const rem    = remPct + "%";
    dom.secondaryText.textContent = rem;
    dom.secondaryReset.textContent = formatResetTime(secondary.resetsAt);
    // Update cylinder
    dom.cylinder7dayFill.style.height = remPct + "%";
    dom.cylinder7dayPct.textContent   = rem;
  } else {
    dom.secondaryText.textContent = "--";
    dom.secondaryReset.textContent = "";
    dom.cylinder7dayFill.style.height = "0%";
    dom.cylinder7dayPct.textContent   = "--";
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

  // Listen for region visibility changes from main process
  window.codexQuota.onRegionVisibilityChanged((visibility) => {
    applyRegionVisibility(visibility);
  });

  // Apply initial region visibility BEFORE first fetch (must await)
  try {
    const visibility = await window.codexQuota.getRegionVisibility();
    applyRegionVisibility(visibility);
  } catch (_) { /* use defaults */ }

  // --- Initial fetch (Codex + DeepSeek run in parallel) --- //
  fetchQuota();

  // Auto-refresh every 5 minutes
  setInterval(fetchQuota, 5 * 60 * 1000);
}

// ---- Boot ---- //
document.addEventListener("DOMContentLoaded", init);
