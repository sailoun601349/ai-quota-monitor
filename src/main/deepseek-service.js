const https = require("node:https");

const API_URL = "api.deepseek.com";
const API_PATH = "/user/balance";

// Configurable: default key + env var override
const DEFAULT_KEY = "sk-8801101afbc74bcd8a532674af958bba";
const API_KEY = process.env.DEEPSEEK_API_KEY || DEFAULT_KEY;

async function getDeepSeekBalance() {
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
