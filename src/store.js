const path = require("path");
const fs = require("fs");

// ─── Supabase Config ──────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; // anon/public key
const TABLE = "signage_data";

// ─── Local vs Cloud detection ─────────────────────────────────────
const IS_LOCAL = (function () {
  // If Supabase env vars are set, always use Supabase (even locally)
  if (SUPABASE_URL && SUPABASE_KEY) return false;
  try {
    const testDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    const testFile = path.join(testDir, ".write-test");
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return true;
  } catch (e) {
    return false;
  }
})();

console.log("[store] Mode:", IS_LOCAL ? "LOCAL (file)" : "SUPABASE (cloud DB)");

const LOCAL_DATA_DIR = path.join(__dirname, "..", "data");

// ─── Supabase REST helpers (no SDK needed) ────────────────────────
async function supaFetch(method, endpoint, body) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const opts = {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "resolution=merge-duplicates,return=representation" : "return=representation",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    console.error(`[store] Supabase ${method} ${endpoint} failed:`, res.status, text);
    return null;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── getData ──────────────────────────────────────────────────────
async function getData(key, defaultValue = null) {
  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_DATA_DIR, key + ".json");
    try {
      if (fs.existsSync(filepath)) {
        return JSON.parse(fs.readFileSync(filepath, "utf-8"));
      }
    } catch (e) { }
    return defaultValue;
  }

  // Supabase: SELECT value FROM signage_data WHERE key = 'xxx'
  const rows = await supaFetch("GET", `${TABLE}?key=eq.${encodeURIComponent(key)}&select=value`);
  if (rows && rows.length > 0 && rows[0].value !== null) {
    return rows[0].value;
  }
  return defaultValue;
}

// ─── setData ──────────────────────────────────────────────────────
async function setData(key, value) {
  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_DATA_DIR, key + ".json");
    fs.writeFileSync(filepath, JSON.stringify(value, null, 2), "utf-8");
    return;
  }

  // Supabase: UPSERT into signage_data (key, value)
  await supaFetch("POST", TABLE, { key, value });
}

// ─── deleteData ───────────────────────────────────────────────────
async function deleteData(key) {
  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_DATA_DIR, key + ".json");
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    return;
  }

  await supaFetch("DELETE", `${TABLE}?key=eq.${encodeURIComponent(key)}`);
}

module.exports = { getData, setData, deleteData };
