/* ============================================================
   AI Quota Monitor — Custom Tray Menu Logic
   ============================================================ */

const menu = document.getElementById("menu");
const items = menu.querySelectorAll(".menu-item[data-action]");

// ---- Region checkbox display names (extend for new providers) ---- //
const REGION_LABELS = {
  codex: "Codex",
  deepseek: "DeepSeek"
};

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

  // Region checkboxes — rebuilt dynamically from state.regions
  buildRegionCheckboxes(state.regions || {});
}

function buildRegionCheckboxes(regions) {
  const container = document.getElementById("regionCheckboxes");
  if (!container) return;

  // Remove old checkboxes
  container.querySelectorAll(".menu-item.checkbox").forEach(el => el.remove());

  // Build one checkbox per region
  for (const [region, visible] of Object.entries(regions)) {
    const label = REGION_LABELS[region] || region;
    const item = document.createElement("div");
    item.className = "menu-item checkbox" + (visible ? " checked" : "");
    item.dataset.action = `toggle-${region}`;
    item.innerHTML = `<span class="check-mark">✓</span><span>${label}</span>`;
    item.addEventListener("click", () => {
      window.codexQuota.trayMenuAction(`toggle-${region}`);
    });
    container.appendChild(item);
  }
}

// ---- Action handlers ---- //
items.forEach((item) => {
  item.addEventListener("click", () => {
    const action = item.dataset.action;
    if (!action) return;
    window.codexQuota.trayMenuAction(action);
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
