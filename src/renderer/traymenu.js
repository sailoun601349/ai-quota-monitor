/* ============================================================
   AI Quota Monitor — Custom Tray Menu Logic
   ============================================================ */

const menu = document.getElementById("menu");
const items = menu.querySelectorAll(".menu-item[data-action]");

// ---- Apply state to UI ---- //
function applyState(state) {
  // Toggle label
  const itemToggle = document.getElementById("itemToggle");
  if (itemToggle) {
    itemToggle.querySelector("span").textContent = state.windowVisible ? "隐藏面板" : "显示面板";
  }

  // Pin label
  const itemPin = document.getElementById("itemPin");
  if (itemPin) {
    itemPin.querySelector("span").textContent = state.isPinned ? "取消置顶" : "置顶";
  }

  // Codex checkbox
  const itemCodex = document.getElementById("itemCodex");
  if (itemCodex) {
    itemCodex.classList.toggle("checked", state.codexVisible);
  }

  // DeepSeek checkbox
  const itemDeepseek = document.getElementById("itemDeepseek");
  if (itemDeepseek) {
    itemDeepseek.classList.toggle("checked", state.deepseekVisible);
  }
}

// ---- Action handlers ---- //
// Checkbox actions: toggle without closing the menu
const CHECKBOX_ACTIONS = new Set(["toggle-codex", "toggle-deepseek"]);

items.forEach((item) => {
  item.addEventListener("click", () => {
    const action = item.dataset.action;
    if (!action) return;

    if (CHECKBOX_ACTIONS.has(action)) {
      // Toggle checkbox — don't close menu, main sends state update back
      window.codexQuota.trayMenuAction(action);
    } else {
      // Action item — execute, main will close menu
      window.codexQuota.trayMenuAction(action);
    }
  });
});

// Close menu when clicking outside
document.addEventListener("click", (e) => {
  if (!menu.contains(e.target)) {
    window.codexQuota.closeTrayMenu();
  }
});

// Close menu on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.codexQuota.closeTrayMenu();
  }
});

// ---- Listen for state updates from main process ---- //
window.codexQuota.onTrayMenuStateUpdated((state) => {
  applyState(state);
});

// ---- Request initial state on load ---- //
window.codexQuota.getTrayMenuState().then((state) => {
  if (state) applyState(state);
}).catch(() => {});
