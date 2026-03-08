const path = require("path");
const fs = require("fs");

// Detect Netlify: check multiple indicators + check if filesystem is writable
const IS_LOCAL = (function() {
  try {
    const testDir = path.join(__dirname, "..", "data");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    // Test write
    const testFile = path.join(testDir, ".write-test");
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return true;
  } catch (e) {
    return false;
  }
})();

const LOCAL_DATA_DIR = path.join(__dirname, "..", "data");

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

async function getData(key, defaultValue = null) {
  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_DATA_DIR, key + ".json");
    try {
      if (fs.existsSync(filepath)) {
        return JSON.parse(fs.readFileSync(filepath, "utf-8"));
      }
    } catch (e) {}
    return defaultValue;
  } else {
    try {
      const store = await getBlobStore();
      if (!store) return defaultValue;
      const val = await store.get(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }
}

async function setData(key, value) {
  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_DATA_DIR, key + ".json");
    fs.writeFileSync(filepath, JSON.stringify(value, null, 2), "utf-8");
  } else {
    try {
      const store = await getBlobStore();
      if (store) await store.set(key, JSON.stringify(value));
    } catch (e) {
      console.error("Blob write error:", e.message);
    }
  }
}

async function deleteData(key) {
  if (IS_LOCAL) {
    const filepath = path.join(LOCAL_DATA_DIR, key + ".json");
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } else {
    try {
      const store = await getBlobStore();
      if (store) await store.delete(key);
    } catch (e) {}
  }
}

module.exports = { getData, setData, deleteData };
