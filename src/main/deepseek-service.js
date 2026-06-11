const https = require("node:https");
const path = require("node:path");
const fs = require("node:fs");

const API_URL = "api.deepseek.com";
const API_PATH = "/user/balance";

/**
 * Read the DeepSeek API key.
 * Priority: env DEEPSEEK_API_KEY > config file > built-in default
 */
function getAPIKey(userDataPath) {
  // 1) Environment variable
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY;

  // 2) Config file in userData
  try {
    const configPath = path.join(userDataPath, "config.json");
    const raw = fs.readFileSync(configPath, "utf8");
    const cfg = JSON.parse(raw);
    if (cfg && cfg.deepseekKey && cfg.deepseekKey.trim()) {
      return cfg.deepseekKey.trim();
    }
  } catch (_) { /* file doesn't exist or is invalid — fall through */ }

  // 3) Built-in default (empty — configure via tray menu or env var)
  return "";
}

async function getDeepSeekBalance(userDataPath) {
  const API_KEY = getAPIKey(userDataPath);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_URL,
      path: API_PATH,
      method: "GET",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Accept": "application/json"
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          // DeepSeek returns: { "is_available": true, "balance_infos": [{ "currency": "CNY", "total_balance": "12.34", ... }] }
          const balanceInfos = data.balance_infos || [];
          if (balanceInfos.length === 0) {
            resolve({ balance: null, currency: null });
            return;
          }
          // Use first balance entry
          const info = balanceInfos[0];
          resolve({
            balance: info.total_balance || "0",
            currency: info.currency || ""
          });
        } catch (e) {
          reject(new Error("Failed to parse DeepSeek balance response"));
        }
      });
    });

    req.on("error", (err) => {
      reject(new Error(`DeepSeek API error: ${err.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("DeepSeek API request timed out"));
    });

    req.end();
  });
}

module.exports = { getDeepSeekBalance };
