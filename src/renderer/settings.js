/* ============================================================
   AI Quota Monitor — Settings Dialog Logic
   ============================================================ */

// ---- DOM refs ---- //
const $ = (id) => document.getElementById(id);
const dom = {
  apiKeyInput: $("apiKeyInput"),
  eyeBtn:      $("eyeBtn"),
  eyeOpen:     $("eyeOpen"),
  eyeOff:      $("eyeOff"),
  confirmBtn:  $("confirmBtn"),
  cancelBtn:   $("cancelBtn"),
  closeBtn:    $("closeBtn"),
};

// ---- State ---- //
let isVisible = false; // key is hidden by default (type=password)

// ---- Eye toggle ---- //
function toggleVisibility() {
  isVisible = !isVisible;
  dom.apiKeyInput.type = isVisible ? "text" : "password";
  dom.eyeOpen.style.display = isVisible ? "none" : "";
  dom.eyeOff.style.display  = isVisible ? "" : "none";
}

// ---- Save ---- //
async function saveKey() {
  const key = dom.apiKeyInput.value.trim();
  try {
    await window.codexQuota.setDeepSeekKey(key);
  } catch (err) {
    console.error("Failed to save DeepSeek key:", err);
  }
  closeWindow();
}

// ---- Close ---- //
function closeWindow() {
  window.codexQuota.closeSettings();
}

// ---- Init ---- //
async function init() {
  // Load existing key (masked)
  try {
    const existing = await window.codexQuota.getDeepSeekKey();
    if (existing) {
      dom.apiKeyInput.value = existing;
      // Select last few chars for context hint, or just leave it as dots
    }
  } catch (_) { /* ignore */ }

  // Wire events
  dom.eyeBtn.addEventListener("click", toggleVisibility);
  dom.confirmBtn.addEventListener("click", saveKey);
  dom.cancelBtn.addEventListener("click", closeWindow);
  dom.closeBtn.addEventListener("click", closeWindow);

  // Enter key saves
  dom.apiKeyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveKey();
    if (e.key === "Escape") closeWindow();
  });

  // Focus input
  dom.apiKeyInput.focus();
}

document.addEventListener("DOMContentLoaded", init);
