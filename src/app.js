/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Pizza Depot Digital Signage — Express App                    ║
 * ║  Works both locally (node) and on Netlify (serverless)        ║
 * ║                                                               ║
 * ║  Routes:                                                      ║
 * ║    /login              → Login page                           ║
 * ║    /admin              → Admin dashboard (protected)          ║
 * ║    /display/:store/:n  → Display page (public, for store TVs) ║
 * ║    /api/auth/*         → Auth endpoints                       ║
 * ║    /api/*              → Data endpoints (protected)           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { getData, setData } = require("./store");
const { initDefaultAdmin, authenticateUser, changePassword, authMiddleware, checkAuth } = require("./auth");
const { getLoginHTML } = require("./pages/login");
const { getPs1Template, getBatTemplate } = require("./setup-scripts");

const app = express();

// ─── Middleware ────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Init default admin on first request
let adminInitialized = false;
app.use(async (req, res, next) => {
  if (!adminInitialized) {
    await initDefaultAdmin();
    adminInitialized = true;
  }
  next();
});

// ─── Default Data ─────────────────────────────────────────────────
const DEFAULT_STORES = [
  { id: "store-101", name: "Pizza Depot — Mississauga Central", screens: 4, address: "Mississauga, ON" },
  { id: "store-102", name: "Pizza Depot — Brampton North", screens: 4, address: "Brampton, ON" },
  { id: "store-103", name: "Pizza Depot — Etobicoke", screens: 4, address: "Etobicoke, ON" },
];

const DEMO_MEDIA = [
  { id: "m1", name: "Pepperoni Special", type: "image", url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&h=600&fit=crop" },
  { id: "m2", name: "Margherita Classic", type: "image", url: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&h=600&fit=crop" },
  { id: "m3", name: "Combo Deal", type: "image", url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&h=600&fit=crop" },
  { id: "m4", name: "Wings & Sides", type: "image", url: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=800&h=600&fit=crop" },
  { id: "m5", name: "Garlic Bread", type: "image", url: "https://images.unsplash.com/photo-1619535860434-ba1d8fa12536?w=800&h=600&fit=crop" },
  { id: "m6", name: "Fresh Salads", type: "image", url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop" },
];

// ═══════════════════════════════════════════════════════════════════
//  AUTH ROUTES (public)
// ═══════════════════════════════════════════════════════════════════

app.get("/login", (req, res) => {
  const user = checkAuth(req);
  if (user) return res.redirect("/admin");
  res.send(getLoginHTML());
});

app.get("/", (req, res) => {
  const user = checkAuth(req);
  if (user) return res.redirect("/admin");
  res.redirect("/login");
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const result = await authenticateUser(username, password);
  if (!result) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // Set httpOnly cookie
  res.cookie("signage_token", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || !!process.env.NETLIFY,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });

  res.json({ ok: true, user: result.user });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("signage_token", { path: "/" });
  res.json({ ok: true });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.post("/api/auth/change-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Both passwords required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  const result = await changePassword(req.user.id, currentPassword, newPassword);
  if (result.error) return res.status(400).json(result);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════
//  API ROUTES (protected — require auth)
// ═══════════════════════════════════════════════════════════════════

// ─── Stores ───────────────────────────────────────────────────────
app.get("/api/stores", authMiddleware, async (req, res) => {
  const stores = await getData("stores", DEFAULT_STORES);
  res.json(stores);
});

app.post("/api/stores", authMiddleware, async (req, res) => {
  const { id, name, screens, address } = req.body;
  if (!id || !name) return res.status(400).json({ error: "id and name required" });

  const stores = await getData("stores", DEFAULT_STORES);
  const existing = stores.find((s) => s.id === id);
  if (existing) {
    Object.assign(existing, { name, screens: screens || 4, address: address || "" });
  } else {
    stores.push({ id, name, screens: screens || 4, address: address || "" });
  }
  await setData("stores", stores);
  res.json({ ok: true, stores });
});

app.delete("/api/stores/:id", authMiddleware, async (req, res) => {
  let stores = await getData("stores", DEFAULT_STORES);
  stores = stores.filter((s) => s.id !== req.params.id);
  await setData("stores", stores);
  res.json({ ok: true });
});

// ─── Media ────────────────────────────────────────────────────────
app.get("/api/media", authMiddleware, async (req, res) => {
  const media = await getData("media", DEMO_MEDIA);
  res.json(media);
});

app.post("/api/media", authMiddleware, async (req, res) => {
  const { name, url, type } = req.body;
  if (!name || !url) return res.status(400).json({ error: "name and url required" });

  const media = await getData("media", DEMO_MEDIA);
  const newItem = {
    id: "m-" + Date.now(),
    name,
    url,
    type: type || "image",
    addedAt: new Date().toISOString(),
  };
  media.push(newItem);
  await setData("media", media);
  res.json({ ok: true, media: newItem });
});

app.delete("/api/media/:id", authMiddleware, async (req, res) => {
  let media = await getData("media", DEMO_MEDIA);
  media = media.filter((m) => m.id !== req.params.id);
  await setData("media", media);

  // Also remove from assignments
  const assignments = await getData("assignments", {});
  for (const key of Object.keys(assignments)) {
    if (assignments[key].mediaIds) {
      assignments[key].mediaIds = assignments[key].mediaIds.filter((id) => id !== req.params.id);
    }
  }
  await setData("assignments", assignments);

  res.json({ ok: true });
});

// ─── Assignments ──────────────────────────────────────────────────
app.get("/api/assignments", authMiddleware, async (req, res) => {
  const assignments = await getData("assignments", {});
  res.json(assignments);
});

app.put("/api/assignments/:storeId/:screenNum", authMiddleware, async (req, res) => {
  const key = `${req.params.storeId}-screen-${req.params.screenNum}`;
  const { mediaIds, interval } = req.body;
  const assignments = await getData("assignments", {});
  assignments[key] = {
    mediaIds: mediaIds || [],
    interval: interval || 8,
    updatedAt: new Date().toISOString(),
  };
  await setData("assignments", assignments);
  res.json({ ok: true, assignment: assignments[key] });
});

app.post("/api/publish", authMiddleware, async (req, res) => {
  const assignments = await getData("assignments", {});
  const publishData = {
    publishedAt: new Date().toISOString(),
    assignments,
  };
  await setData("last-publish", publishData);
  res.json({ ok: true, publishedAt: publishData.publishedAt });
});

// ─── Heartbeat ────────────────────────────────────────────────────
app.post("/api/heartbeat", async (req, res) => {
  const { storeId, screenCount } = req.body;
  const heartbeats = await getData("heartbeats", {});
  heartbeats[storeId] = {
    lastSeen: new Date().toISOString(),
    screenCount,
    ip: req.headers["x-forwarded-for"] || req.ip,
  };
  await setData("heartbeats", heartbeats);
  res.json({ ok: true });
});

app.get("/api/heartbeats", authMiddleware, async (req, res) => {
  const heartbeats = await getData("heartbeats", {});
  res.json(heartbeats);
});

// ─── Setup Scripts ────────────────────────────────────────────────
app.post("/api/setup-scripts", authMiddleware, (req, res) => {
  const { storeId, baseUrl } = req.body;
  if (!storeId || !baseUrl) return res.status(400).json({ error: "storeId and baseUrl required" });
  res.json({
    ok: true,
    ps1: getPs1Template(baseUrl, storeId),
    bat: getBatTemplate()
  });
});

// ═══════════════════════════════════════════════════════════════════
//  DISPLAY ENDPOINT (public — no auth required, for store TVs)
// ═══════════════════════════════════════════════════════════════════

app.get("/api/display-data/:storeId/:screenNum", async (req, res) => {
  const key = `${req.params.storeId}-screen-${req.params.screenNum}`;
  const assignments = await getData("assignments", {});
  const media = await getData("media", DEMO_MEDIA);
  const assignment = assignments[key] || { mediaIds: [], interval: 8 };

  const resolvedMedia = (assignment.mediaIds || [])
    .map((id) => media.find((m) => m.id === id))
    .filter(Boolean);

  res.json({ ...assignment, media: resolvedMedia });
});

app.get("/display/:storeId/screen/:screenNum", (req, res) => {
  const { storeId, screenNum } = req.params;
  res.send(getDisplayHTML(storeId, screenNum));
});

// ═══════════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD (protected)
// ═══════════════════════════════════════════════════════════════════

app.get("/admin", (req, res) => {
  const user = checkAuth(req);
  if (!user) return res.redirect("/login");
  res.send(getAdminHTML(user));
});

// ═══════════════════════════════════════════════════════════════════
//  HTML GENERATORS
// ═══════════════════════════════════════════════════════════════════

function getDisplayHTML(storeId, screenNum) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Display - ${storeId} Screen ${screenNum}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;background:#000;cursor:none}
    #display{width:100vw;height:100vh;position:relative;overflow:hidden}
    .slide{position:absolute;top:0;left:0;width:100%;height:100%;opacity:0;transition:opacity 1s ease-in-out}
    .slide.active{opacity:1}
    .slide img,.slide video{width:100%;height:100%;object-fit:cover}
    #no-content{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#333;font-family:'Courier New',monospace}
    #no-content .icon{font-size:72px;margin-bottom:16px}
    #no-content .label{font-size:18px;letter-spacing:3px;text-transform:uppercase}
    #no-content .sub{font-size:12px;margin-top:8px;color:#555}
    #status{position:fixed;bottom:8px;right:8px;width:8px;height:8px;border-radius:50%;background:#1a1a1a;transition:background .3s}
    #status.ok{background:#0a3}
    #status.err{background:#c00}
  </style>
</head>
<body>
  <div id="display">
    <div id="no-content">
      <div class="icon">📺</div>
      <div class="label">Connecting...</div>
      <div class="sub">${storeId} — Screen ${screenNum}</div>
    </div>
  </div>
  <div id="status"></div>
  <script>
    const SID="${storeId}",SNUM="${screenNum}",API=window.location.origin,POLL=15000;
    let media=[],interval=8,idx=0,timer=null,lastHash="";

    async function fetchContent(){
      try{
        const r=await fetch(API+"/api/display-data/"+SID+"/"+SNUM);
        const d=await r.json();
        document.getElementById("status").className="ok";
        const hash=JSON.stringify(d.mediaIds)+d.interval;
        if(hash===lastHash)return;
        lastHash=hash;
        media=d.media||[];interval=d.interval||8;idx=0;
        render();startLoop();
      }catch(e){document.getElementById("status").className="err"}
    }

    function render(){
      const el=document.getElementById("display");
      el.innerHTML="";
      if(!media.length){
        el.innerHTML='<div id="no-content"><div class="icon">📺</div><div class="label">No Content</div><div class="sub">'+SID+' — Screen '+SNUM+'</div></div>';
        return;
      }
      media.forEach((m,i)=>{
        const s=document.createElement("div");
        s.className="slide"+(i===0?" active":"");
        if(m.type==="video"){
          const v=document.createElement("video");
          v.src=m.url;v.autoplay=true;v.muted=true;v.loop=true;v.playsInline=true;
          s.appendChild(v);
        }else{
          const img=document.createElement("img");
          img.src=m.url;img.alt=m.name||"";
          s.appendChild(img);
        }
        el.appendChild(s);
      });
    }

    function startLoop(){
      if(timer)clearInterval(timer);
      if(media.length<=1)return;
      timer=setInterval(()=>{
        const sl=document.querySelectorAll(".slide");
        if(!sl.length)return;
        sl.forEach(s=>s.classList.remove("active"));
        idx=(idx+1)%sl.length;
        sl[idx].classList.add("active");
      },interval*1000);
    }

    async function heartbeat(){
      try{await fetch(API+"/api/heartbeat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({storeId:SID,screenCount:1})})}catch(e){}
    }

    fetchContent();setInterval(fetchContent,POLL);
    heartbeat();setInterval(heartbeat,60000);
    document.addEventListener("contextmenu",e=>e.preventDefault());
  </script>
</body>
</html>`;
}

function getAdminHTML(user) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pizza Depot Signage — Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
  <style>
    :root{--fire:#e84e0f;--fire-glow:rgba(232,78,15,.15);--fire-dim:rgba(232,78,15,.08);--bg:#08080a;--surface:#111114;--surface2:#19191e;--border:rgba(255,255,255,.06);--border-hover:rgba(255,255,255,.12);--text:#e8e8ec;--text-dim:#6e6e78;--text-muted:#3e3e48;--mono:'JetBrains Mono',monospace;--sans:'Outfit',sans-serif}
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:var(--bg);color:var(--text);font-family:var(--sans)}
    ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
    .header{padding:16px 28px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,.4);backdrop-filter:blur(20px);position:sticky;top:0;z-index:50}
    .header-left{display:flex;align-items:center;gap:14px}
    .logo{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,#e84e0f,#ff7a3d);display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 4px 20px rgba(232,78,15,.25)}
    .header h1{font-size:20px;font-weight:800;letter-spacing:-.5px}
    .header h1 span{color:var(--fire)}
    .header-sub{font-family:var(--mono);font-size:10px;color:var(--text-muted);letter-spacing:2px;text-transform:uppercase;margin-top:2px}
    .header-actions{display:flex;gap:10px;align-items:center}
    .user-badge{font-family:var(--mono);font-size:11px;color:var(--text-dim);padding:6px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border)}
    .btn{border:none;border-radius:10px;padding:10px 20px;font-family:var(--sans);font-weight:600;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all .2s}
    .btn-ghost{background:var(--surface2);border:1px solid var(--border);color:var(--text-dim)}
    .btn-ghost:hover{border-color:var(--border-hover);color:var(--text)}
    .btn-fire{background:linear-gradient(135deg,#e84e0f,#ff6b2b);color:#fff;box-shadow:0 4px 20px rgba(232,78,15,.3)}
    .btn-fire:hover{box-shadow:0 6px 28px rgba(232,78,15,.4);transform:translateY(-1px)}
    .btn-sm{padding:6px 12px;font-size:11px;border-radius:8px}
    .btn-danger{background:rgba(200,40,40,.15);border:1px solid rgba(200,40,40,.2);color:#e44}
    .layout{display:flex;min-height:calc(100vh - 73px)}
    .sidebar{width:270px;padding:20px 14px;border-right:1px solid var(--border);background:rgba(0,0,0,.2);overflow-y:auto;flex-shrink:0}
    .sidebar-label{font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--text-muted);padding:0 10px;margin-bottom:10px}
    .store-btn{width:100%;text-align:left;padding:12px 14px;border-radius:10px;border:none;cursor:pointer;background:transparent;margin-bottom:4px;border-left:3px solid transparent;transition:all .15s}
    .store-btn:hover{background:var(--surface)}
    .store-btn.active{background:var(--fire-dim);border-left-color:var(--fire)}
    .store-btn .name{font-family:var(--sans);font-size:13px;font-weight:600;color:var(--text-dim);display:block}
    .store-btn.active .name{color:var(--text)}
    .store-btn .meta{font-family:var(--mono);font-size:10px;color:var(--text-muted);margin-top:3px}
    .main{flex:1;padding:28px;overflow-y:auto}
    .main h2{font-size:22px;font-weight:700;margin-bottom:4px}
    .main .subtitle{font-family:var(--mono);font-size:11px;color:var(--text-muted);margin-bottom:24px}
    .screen-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
    .screen-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;overflow:hidden;transition:border-color .2s}
    .screen-card:hover{border-color:var(--border-hover)}
    .screen-preview{height:170px;background:#000;position:relative;overflow:hidden}
    .screen-preview img{width:100%;height:100%;object-fit:cover}
    .screen-badge{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);padding:4px 12px;border-radius:20px;font-family:var(--mono);font-size:10px;font-weight:700;color:var(--fire);letter-spacing:1.5px;text-transform:uppercase}
    .screen-link{position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.6);padding:4px 10px;border-radius:8px;font-family:var(--mono);font-size:9px;color:var(--text-muted);text-decoration:none}
    .screen-link:hover{color:var(--text)}
    .screen-body{padding:16px}
    .playlist-label{font-family:var(--mono);font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px}
    .playlist-item{display:flex;align-items:center;gap:8px;background:var(--surface2);border-radius:8px;padding:6px 8px;margin-bottom:5px}
    .playlist-item img{width:36px;height:26px;border-radius:4px;object-fit:cover}
    .playlist-item .name{font-size:12px;color:#ccc;flex:1}
    .playlist-item .rbtn{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:2px}
    .playlist-item .rbtn:hover{color:#e44}
    .empty-pl{font-size:12px;color:var(--text-muted);font-style:italic}
    .interval-row{display:flex;align-items:center;gap:8px;margin:12px 0}
    .interval-row label{font-size:11px;color:var(--text-dim)}
    .interval-row select{background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;color:var(--text);font-size:12px;font-family:var(--mono)}
    .add-btn{width:100%;padding:8px;border-radius:8px;background:var(--surface2);border:1px dashed var(--border);color:var(--text-muted);font-size:12px;font-weight:600;cursor:pointer;text-align:center;transition:all .15s}
    .add-btn:hover{border-color:var(--fire);color:var(--fire);background:var(--fire-dim)}
    .media-picker{margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:220px;overflow-y:auto;padding:4px}
    .mpick{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:4px;cursor:pointer;text-align:center;transition:border-color .15s}
    .mpick:hover{border-color:rgba(232,78,15,.4)}
    .mpick img{width:100%;height:52px;border-radius:4px;object-fit:cover}
    .mpick .name{font-size:9px;color:var(--text-dim);margin-top:4px;font-family:var(--mono)}
    .media-grid-mini{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:0 4px}
    .mmini{border-radius:8px;overflow:hidden;border:1px solid var(--border);position:relative}
    .mmini img{width:100%;height:48px;object-fit:cover;display:block}
    .mmini .name{padding:3px 6px;font-family:var(--mono);font-size:8px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .mmini .del{position:absolute;top:2px;right:2px;background:rgba(0,0,0,.7);border:none;color:#e44;width:18px;height:18px;border-radius:50%;font-size:11px;cursor:pointer;display:none;align-items:center;justify-content:center}
    .mmini:hover .del{display:flex}
    .quick-section{margin-top:28px;padding:20px;background:var(--surface);border:1px solid var(--border);border-radius:16px}
    .qrow{display:flex;gap:10px;flex-wrap:wrap}
    .add-media-section{margin-top:16px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px}
    .add-media-section input{width:100%;padding:8px 12px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px;margin-bottom:8px;outline:none}
    .add-media-section input:focus{border-color:rgba(232,78,15,.4)}
    .add-media-section input::placeholder{color:var(--text-muted)}
    .toast{position:fixed;top:20px;right:20px;z-index:200;background:var(--fire);color:#fff;padding:12px 24px;border-radius:12px;font-family:var(--mono);font-size:13px;font-weight:600;box-shadow:0 8px 32px rgba(232,78,15,.3);animation:slideIn .3s ease;display:none}
    .toast.show{display:block}
    @keyframes slideIn{from{transform:translateX(100px);opacity:0}to{transform:translateX(0);opacity:1}}
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:100;display:none;align-items:center;justify-content:center}
    .modal-overlay.show{display:flex}
    .modal{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:32px;width:400px;max-width:90vw}
    .modal h3{font-size:18px;margin-bottom:16px}
    .modal input{width:100%;padding:12px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:14px;margin-bottom:12px;outline:none}
    .modal input:focus{border-color:rgba(232,78,15,.4)}
    .modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
  </style>
</head>
<body>
  <div class="toast" id="toast"></div>
  <div class="modal-overlay" id="pwModal">
    <div class="modal">
      <h3>Change Password</h3>
      <input type="password" id="currPw" placeholder="Current password">
      <input type="password" id="newPw" placeholder="New password (min 6 chars)">
      <input type="password" id="confirmPw" placeholder="Confirm new password">
      <div id="pwError" style="color:#e44;font-size:12px;margin-bottom:8px;display:none"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('pwModal').classList.remove('show')">Cancel</button>
        <button class="btn btn-fire btn-sm" onclick="doChangePw()">Update Password</button>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="setupModal">
    <div class="modal">
      <h3>Download Windows Setup</h3>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">This will generate the installation files configured specifically for this store. Run them on the store's PC to set up the displays automatically.</div>
      <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:6px;font-family:var(--mono)">STORE ID</label>
      <input type="text" id="setupStoreId" readonly style="background:rgba(255,255,255,.02);color:var(--text-dim)">
      <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:6px;margin-top:8px;font-family:var(--mono)">SERVER URL</label>
      <input type="text" id="setupBaseUrl" placeholder="https://signage.pizzadepot.com">
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('setupModal').classList.remove('show')">Cancel</button>
        <button class="btn btn-fire btn-sm" onclick="downloadSetup()">Download Setup .zip</button>
      </div>
    </div>
  </div>

  <div class="header">
    <div class="header-left">
      <div class="logo">🍕</div>
      <div>
        <h1>Pizza Depot <span>Signage</span></h1>
        <div class="header-sub">Franchise Display Manager</div>
      </div>
    </div>
    <div class="header-actions">
      <div id="lastPublish" style="font-family:var(--mono);font-size:10px;color:var(--text-muted)"></div>
      <div class="user-badge">👤 ${user.name || user.username}</div>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('pwModal').classList.add('show')">🔑 Password</button>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Logout</button>
      <button class="btn btn-fire" onclick="publishAll()">↑ Publish All</button>
    </div>
  </div>

  <div class="layout">
    <div class="sidebar">
      <div class="sidebar-label" style="margin-top:4px">Stores</div>
      <div id="storeList"></div>
      <div class="sidebar-label" style="margin-top:28px">Media Library</div>
      <div id="mediaLib"></div>
      <div class="add-media-section" style="margin-top:12px">
        <div class="playlist-label">Add Media by URL</div>
        <input type="text" id="newMediaName" placeholder="Name (e.g. Summer Promo)">
        <input type="text" id="newMediaUrl" placeholder="URL (https://...)">
        <select id="newMediaType" style="width:100%;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;margin-bottom:8px;font-family:var(--sans)">
          <option value="image">Image</option>
          <option value="video">Video (MP4, WebM)</option>
        </select>
        <button class="add-btn" onclick="addMediaByUrl()">+ Add to Library</button>
      </div>
    </div>

    <div class="main" id="mainContent">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h2 id="storeTitle">Select a store</h2>
        <button class="btn btn-ghost btn-sm" id="setupBtn" style="display:none" onclick="openSetupModal()">⬇️ Windows PC Setup</button>
      </div>
      <div class="subtitle" id="storeSub">Choose a location from the sidebar</div>
      <div class="screen-grid" id="screenGrid"></div>
      <div class="quick-section" id="quickActions" style="display:none">
        <div class="playlist-label">Quick Actions</div>
        <div class="qrow">
          <button class="btn btn-ghost btn-sm" onclick="assignAll()">▦ Assign All to All Screens</button>
          <button class="btn btn-ghost btn-sm" onclick="clearAll()">✕ Clear All Screens</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    let stores=[],media=[],assignments={},selStore=null,pickers={};
    const API="";

    async function api(path,opts={}){
      const r=await fetch(API+path,{headers:{"Content-Type":"application/json"},credentials:"include",...opts});
      if(r.status===401){window.location.href="/login";return null}
      return r.json();
    }
    function toast(m){const e=document.getElementById("toast");e.textContent="✓ "+m;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2500)}
    async function loadData(){
      const [s,m,a]=await Promise.all([api("/api/stores"),api("/api/media"),api("/api/assignments")]);
      if(!s)return;
      stores=s;media=m;assignments=a;
      if(stores.length&&!selStore)selectStore(stores[0].id);
      renderSidebar();
    }
    function renderSidebar(){
      document.getElementById("storeList").innerHTML=stores.map(s=>{
        const a=s.id===selStore?"active":"";
        return '<button class="store-btn '+a+'" onclick="selectStore(\\''+s.id+'\\')"><span class="name">'+s.name+'</span><span class="meta">'+s.screens+' screens</span></button>';
      }).join("");
      document.getElementById("mediaLib").innerHTML=media.length===0?'<div style="padding:8px;font-size:11px;color:#3e3e48;font-style:italic">No media yet</div>':'<div class="media-grid-mini">'+media.map(m=>'<div class="mmini"><img src="'+m.url+'" alt="'+m.name+'"><div class="name">'+m.name+'</div><button class="del" onclick="delMedia(\\''+m.id+'\\')">✕</button></div>').join("")+"</div>";
    }
    function selectStore(id){selStore=id;pickers={};renderSidebar();renderScreens()}
    function renderScreens(){
      const store=stores.find(s=>s.id===selStore);
      if(!store)return;
      document.getElementById("storeTitle").textContent=store.name;
      document.getElementById("storeSub").textContent="Manage content for "+store.screens+" display screens";
      document.getElementById("quickActions").style.display="block";
      document.getElementById("setupBtn").style.display="flex";
      const grid=document.getElementById("screenGrid");
      grid.innerHTML="";
      for(let i=1;i<=store.screens;i++){
        const key=store.id+"-screen-"+i;
        const asgn=assignments[key]||{mediaIds:[],interval:8};
        const items=(asgn.mediaIds||[]).map(id=>media.find(m=>m.id===id)).filter(Boolean);
        const durl=window.location.origin+"/display/"+store.id+"/screen/"+i;
        const preview=items.length?'<img src="'+items[0].url+'" alt="">':'<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#333;font-size:40px">📺</div>';
        const playlist=items.length===0?'<div class="empty-pl">No content assigned</div>':items.map(m=>'<div class="playlist-item"><img src="'+m.url+'" alt=""><span class="name">'+m.name+'</span><button class="rbtn" onclick="removeFrom(\\''+store.id+'\\','+i+',\\''+m.id+'\\')">✕</button></div>').join("");
        const po=pickers[key];
        const unassigned=media.filter(m=>!(asgn.mediaIds||[]).includes(m.id));
        const picker=po?'<div class="media-picker">'+unassigned.map(m=>'<div class="mpick" onclick="addTo(\\''+store.id+'\\','+i+',\\''+m.id+'\\')"><img src="'+m.url+'" alt=""><div class="name">'+m.name+'</div></div>').join("")+(unassigned.length===0?'<div style="grid-column:span 2;text-align:center;font-size:11px;color:#555;padding:16px">All media assigned</div>':"")+"</div>":"";
        const intervals=[5,8,10,15,20,30,60].map(s=>'<option value="'+s+'"'+(asgn.interval==s?" selected":"")+'>'+s+'s</option>').join("");
        grid.innerHTML+='<div class="screen-card"><div class="screen-preview">'+preview+'<div class="screen-badge">Screen '+i+'</div><a href="'+durl+'" target="_blank" class="screen-link">Open display ↗</a></div><div class="screen-body"><div class="playlist-label">Playlist ('+items.length+' items)</div>'+playlist+'<div class="interval-row"><label>⏱ Rotate every</label><select onchange="setInt(\\''+store.id+'\\','+i+',this.value)">'+intervals+'</select></div><button class="add-btn" onclick="togglePicker(\\''+key+'\\')">'+( po?"− Close":"+ Add Media")+"</button>"+picker+"</div></div>";
      }
    }
    function togglePicker(k){pickers[k]=!pickers[k];renderScreens()}
    async function addTo(sid,n,mid){
      const k=sid+"-screen-"+n;
      const c=assignments[k]||{mediaIds:[],interval:8};
      c.mediaIds=[...(c.mediaIds||[]),mid];assignments[k]=c;
      await api("/api/assignments/"+sid+"/"+n,{method:"PUT",body:JSON.stringify(c)});
      pickers[k]=false;renderScreens();toast("Media added");
    }
    async function removeFrom(sid,n,mid){
      const k=sid+"-screen-"+n;
      const c=assignments[k]||{mediaIds:[],interval:8};
      c.mediaIds=(c.mediaIds||[]).filter(id=>id!==mid);assignments[k]=c;
      await api("/api/assignments/"+sid+"/"+n,{method:"PUT",body:JSON.stringify(c)});
      renderScreens();
    }
    async function setInt(sid,n,v){
      const k=sid+"-screen-"+n;
      const c=assignments[k]||{mediaIds:[],interval:8};
      c.interval=parseInt(v);assignments[k]=c;
      await api("/api/assignments/"+sid+"/"+n,{method:"PUT",body:JSON.stringify(c)});
    }
    async function assignAll(){
      const store=stores.find(s=>s.id===selStore);if(!store)return;
      for(let i=1;i<=store.screens;i++){
        const k=store.id+"-screen-"+i;
        assignments[k]={mediaIds:media.map(m=>m.id),interval:10};
        await api("/api/assignments/"+store.id+"/"+i,{method:"PUT",body:JSON.stringify(assignments[k])});
      }
      renderScreens();toast("All media assigned");
    }
    async function clearAll(){
      const store=stores.find(s=>s.id===selStore);if(!store)return;
      for(let i=1;i<=store.screens;i++){
        const k=store.id+"-screen-"+i;
        assignments[k]={mediaIds:[],interval:8};
        await api("/api/assignments/"+store.id+"/"+i,{method:"PUT",body:JSON.stringify(assignments[k])});
      }
      renderScreens();toast("All screens cleared");
    }
    async function publishAll(){
      const r=await api("/api/publish",{method:"POST"});
      if(r)document.getElementById("lastPublish").textContent="Published: "+new Date(r.publishedAt).toLocaleString();
      toast("Published to all stores!");
    }
    async function addMediaByUrl(){
      const name=document.getElementById("newMediaName").value.trim();
      const url=document.getElementById("newMediaUrl").value.trim();
      const type=document.getElementById("newMediaType").value;
      if(!name||!url){toast("Name and URL required");return}
      await api("/api/media",{method:"POST",body:JSON.stringify({name,url,type})});
      document.getElementById("newMediaName").value="";
      document.getElementById("newMediaUrl").value="";
      media=await api("/api/media");renderSidebar();renderScreens();toast("Media added");
    }
    async function delMedia(id){
      if(!confirm("Delete this media from all screens?"))return;
      await api("/api/media/"+id,{method:"DELETE"});
      media=await api("/api/media");assignments=await api("/api/assignments");
      renderSidebar();renderScreens();toast("Deleted");
    }
    async function logout(){
      await api("/api/auth/logout",{method:"POST"});
      window.location.href="/login";
    }
    async function doChangePw(){
      const curr=document.getElementById("currPw").value;
      const nw=document.getElementById("newPw").value;
      const cf=document.getElementById("confirmPw").value;
      const err=document.getElementById("pwError");
      if(nw!==cf){err.textContent="Passwords don't match";err.style.display="block";return}
      const r=await api("/api/auth/change-password",{method:"POST",body:JSON.stringify({currentPassword:curr,newPassword:nw})});
      if(r&&r.ok){document.getElementById("pwModal").classList.remove("show");toast("Password updated");
        document.getElementById("currPw").value="";document.getElementById("newPw").value="";document.getElementById("confirmPw").value="";}
      else{err.textContent=(r&&r.error)||"Failed";err.style.display="block"}
    }
    
    function openSetupModal(){
      if(!selStore)return;
      document.getElementById("setupStoreId").value=selStore;
      document.getElementById("setupBaseUrl").value=window.location.origin;
      document.getElementById("setupModal").classList.add("show");
    }
    
    async function downloadSetup(){
      const storeId=document.getElementById("setupStoreId").value;
      const baseUrl=document.getElementById("setupBaseUrl").value;
      if(!storeId||!baseUrl){toast("Missing details");return}
      
      const r=await api("/api/setup-scripts",{method:"POST",body:JSON.stringify({storeId,baseUrl})});
      if(r&&r.ok){
        const zip=new JSZip();
        zip.file("Setup-PizzaSignage.bat", r.bat);
        zip.file("LaunchSignage.ps1", r.ps1);
        const content=await zip.generateAsync({type:"blob"});
        saveAs(content,"PizzaSignage_Setup_"+storeId+".zip");
        document.getElementById("setupModal").classList.remove("show");
        toast("Setup files downloaded!");
      }else{
        toast("Failed to generate setup files");
      }
    }

    loadData();
  </script>
</body>
</html>`;
}

module.exports = { app };
