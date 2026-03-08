/**
 * Data Store Abstraction
 * - Production (Netlify): Uses Netlify Blobs (serverless KV store)
 * - Local development: Uses JSON files on disk
 */

const path = require("path");
const fs = require("fs");

const IS_NETLIFY = !!process.env.NETLIFY || !!process.env.NETLIFY_BLOBS_CONTEXT;
const LOCAL_DATA_DIR = path.join(__dirname, "..", "data");

// Ensure local data dir exists
if (!IS_NETLIFY && !fs.existsSync(LOCAL_DATA_DIR)) {
  fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
}

// ─── Netlify Blobs Store ──────────────────────────────────────────
let blobStore = null;

async function getBlobStore() {
  if (blobStore) return blobStore;
  try {
    const { getStore } = require("@netlify/blobs");
    blobStore = getStore("signage-data");
    return blobStore;
  } catch (e) {
    console.error("Netlify Blobs not available:", e.message);
    return null;
  }
}

// ─── Unified API ──────────────────────────────────────────────────
async function getData(key, defaultValue = null) {
  if (IS_NETLIFY) {
    try {
      const store = await getBlobStore();
      const val = await store.get(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  } else {
    const filepath = path.join(LOCAL_DATA_DIR, `${key}.json`);
    try {
      if (fs.existsSync(filepath)) {
        return JSON.parse(fs.readFileSync(filepath, "utf-8"));
      }
    } catch (e) {}
    return defaultValue;
  }
}

async function setData(key, value) {
  if (IS_NETLIFY) {
    try {
      const store = await getBlobStore();
      await store.set(key, JSON.stringify(value));
    } catch (e) {
      console.error("Blob write error:", e.message);
    }
  } else {
    const filepath = path.join(LOCAL_DATA_DIR, `${key}.json`);
    fs.writeFileSync(filepath, JSON.stringify(value, null, 2), "utf-8");
  }
}

async function deleteData(key) {
  if (IS_NETLIFY) {
    try {
      const store = await getBlobStore();
      await store.delete(key);
    } catch (e) {}
  } else {
    const filepath = path.join(LOCAL_DATA_DIR, `${key}.json`);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
}

module.exports = { getData, setData, deleteData };
