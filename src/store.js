const path = require("path");
const fs = require("fs");

// Detect Netlify: check multiple indicators + check if filesystem is writable
const IS_LOCAL = (function () {
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

console.log("[store] Mode:", IS_LOCAL ? "LOCAL (file system)" : "NETLIFY (blobs)");

const LOCAL_DATA_DIR = path.join(__dirname, "..", "data");

let blobStore = null;

async function getBlobStore() {
  if (blobStore) return blobStore;
  try {
    const { getStore } = require("@netlify/blobs");
    blobStore = getStore({ name: "signage-data", consistency: "strong" });
    console.log("[store] Netlify Blobs initialized (strong consistency)");
    return blobStore;
  } catch (e) {
    console.error("[store] Netlify Blobs init FAILED:", e.message);
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
    } catch (e) {
      console.error("[store] Local read error:", key, e.message);
    }
    return defaultValue;
  } else {
    try {
      const store = await getBlobStore();
      if (!store) {
        console.error("[store] No blob store for getData:", key);
        return defaultValue;
      }
      const val = await store.get(key);
      console.log("[store] GET", key, "->", val ? val.length + " chars" : "null");
      return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
      console.error("[store] Blob read error:", key, e.message);
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
      if (!store) {
        console.error("[store] No blob store for setData:", key);
        return;
      }
      const json = JSON.stringify(value);
      await store.set(key, json);
      console.log("[store] SET", key, "->", json.length, "chars OK");

      // Verify write succeeded by reading back
      const verify = await store.get(key);
      if (!verify) {
        console.error("[store] VERIFY FAILED - written data not readable:", key);
      }
    } catch (e) {
      console.error("[store] Blob write error:", key, e.message, e.stack);
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
    } catch (e) {
      console.error("[store] Blob delete error:", key, e.message);
    }
  }
}

module.exports = { getData, setData, deleteData };
