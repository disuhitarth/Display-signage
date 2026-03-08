# 🍕 Pizza Depot Digital Signage

**Remotely manage menu content on store TVs from a central admin dashboard.**

A full-stack digital signage system built for franchise operations. Upload images, assign them to screens, and push updates to all store locations — no technical staff required at the store level.

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![Express](https://img.shields.io/badge/Express-4.x-blue) ![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7) ![License](https://img.shields.io/badge/License-MIT-yellow)

---

## Features

- **Admin Dashboard** — Web-based control panel to manage all stores and screens
- **Authentication** — JWT-based login with bcrypt password hashing
- **Multi-Store Support** — Manage unlimited store locations from one dashboard
- **Per-Screen Control** — Assign different playlists to each TV independently
- **Auto-Rotating Playlists** — Images cycle with configurable intervals (5s–60s)
- **Live Display Pages** — Each TV loads a URL that auto-updates every 15 seconds
- **Store Heartbeats** — Monitor which store PCs are online
- **Zero Store Interaction** — Windows scripts auto-launch Chrome kiosk on boot
- **Netlify Ready** — Deploy as serverless functions with Netlify Blobs for storage

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                FRANCHISE HQ                      │
│  Browser → /admin (protected by login)           │
│  Upload images, assign to screens, publish       │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────┐
│            NETLIFY (or any host)                 │
│  Express app as serverless functions             │
│  Netlify Blobs for data storage                  │
│  API + Admin Dashboard + Display Pages           │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS (polls every 15s)
                       ▼
┌─────────────────────────────────────────────────┐
│              STORE PC (Windows)                  │
│  4 Chrome kiosk windows → 4 TVs                 │
│  /display/store-101/screen/1                     │
│  /display/store-101/screen/2                     │
│  /display/store-101/screen/3                     │
│  /display/store-101/screen/4                     │
│  Auto-starts on boot, auto-restarts on crash     │
└─────────────────────────────────────────────────┘
```

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- npm

### 1. Clone and install

```bash
git clone https://github.com/disuhitarth/Display-signage.git
cd Display-signage
npm install
```

### 2. Start the server

```bash
npm start
```

### 3. Open in browser

| URL | Purpose |
|-----|---------|
| http://localhost:3000/login | Login page |
| http://localhost:3000/admin | Admin dashboard |
| http://localhost:3000/display/store-101/screen/1 | TV display (Screen 1) |
| http://localhost:3000/display/store-101/screen/2 | TV display (Screen 2) |

### 4. Default login

```
Username: admin
Password: admin123
```

> ⚠️ Change the default password after first login using the 🔑 button in the admin header.

---

## Deploy to Netlify

### Option A: One-Click Deploy from GitHub

1. Push this repo to GitHub (see below)
2. Go to [app.netlify.com](https://app.netlify.com)
3. Click **"Add new site" → "Import an existing project"**
4. Select **GitHub** → Choose this repo
5. Netlify auto-detects settings from `netlify.toml`:
   - **Build command:** `echo 'No build step needed'`
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
6. Add **Environment Variables** in Netlify UI → Site settings → Environment variables:

   | Variable | Value | Required |
   |----------|-------|----------|
   | `JWT_SECRET` | A random string (e.g. `my-super-secret-key-abc123`) | **Yes** |
   | `ADMIN_PASSWORD` | Your admin password for first login | Optional (default: `admin123`) |

7. Click **Deploy site**
8. Your signage system is live at `https://your-site-name.netlify.app`

### Option B: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Link to your site (or create a new one)
netlify init

# Deploy
netlify deploy --prod
```

### After Deployment

1. Visit `https://your-site.netlify.app/login`
2. Login with `admin` / `admin123` (or your custom `ADMIN_PASSWORD`)
3. Change your password immediately
4. Start managing your store displays!

---

## Push to GitHub

### First time setup

```bash
cd Display-signage

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Pizza Depot Digital Signage System"

# Add remote
git remote add origin https://github.com/disuhitarth/Display-signage.git

# Push
git branch -M main
git push -u origin main
```

### Subsequent updates

```bash
git add .
git commit -m "Your update message"
git push
```

Netlify auto-deploys on every push to `main`.

---

## Store PC Setup (Windows)

For each store location, run the one-time setup on the Windows PC connected to the TVs.

### Files needed
- `store-setup/Setup-PizzaSignage.bat`
- `store-setup/LaunchSignage.ps1`

### Steps

1. Copy both files from `store-setup/` to a USB drive
2. Plug USB into the store PC
3. Double-click `Setup-PizzaSignage.bat`
4. Enter the **Store ID** (e.g. `store-101`)
5. Enter the **Server URL** (e.g. `https://your-site.netlify.app`)
6. Press any key to test
7. Restart the PC to verify auto-start

### What it does automatically
- Detects all connected monitors/TVs
- Launches Chrome in kiosk mode on each TV
- Disables screensaver and sleep
- Hides the mouse cursor
- Auto-restarts Chrome if it crashes (checks every 60s)
- Starts on Windows boot via Startup folder + Scheduled Task

---

## Project Structure

```
Display-signage/
├── netlify/
│   └── functions/
│       └── api.js              # Netlify serverless entry point
├── src/
│   ├── app.js                  # Main Express app (routes, API, HTML)
│   ├── auth.js                 # JWT authentication + bcrypt
│   ├── store.js                # Data layer (Netlify Blobs / local JSON)
│   ├── local-server.js         # Local dev server wrapper
│   └── pages/
│       └── login.js            # Login page HTML
├── public/
│   └── index.html              # Redirect to /login
├── store-setup/
│   ├── Setup-PizzaSignage.bat  # One-click Windows installer
│   └── LaunchSignage.ps1       # PowerShell launcher + watchdog
├── netlify.toml                # Netlify build & redirect config
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## API Reference

### Auth (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login (returns JWT cookie) |
| POST | `/api/auth/logout` | Logout (clears cookie) |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/change-password` | Change password |

### Stores (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stores` | List all stores |
| POST | `/api/stores` | Add/update a store |
| DELETE | `/api/stores/:id` | Delete a store |

### Media (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/media` | List all media |
| POST | `/api/media` | Add media (by URL) |
| DELETE | `/api/media/:id` | Delete media |

### Assignments (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assignments` | Get all screen assignments |
| PUT | `/api/assignments/:storeId/:screenNum` | Update screen playlist |
| POST | `/api/publish` | Publish all changes |

### Display (Public — for store TVs)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/display-data/:storeId/:screenNum` | Get screen content (JSON) |
| GET | `/display/:storeId/screen/:screenNum` | Display page (HTML) |

### Heartbeat (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/heartbeat` | Store PC reports status |
| GET | `/api/heartbeats` | View all store statuses |

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT token signing | `pizza-depot-signage-secret-change-me` |
| `ADMIN_PASSWORD` | Initial admin password (first run only) | `admin123` |
| `PORT` | Local dev server port | `3000` |

---

## Customization

### Add a new store
1. Login to admin dashboard
2. (For now) Add via API: `POST /api/stores` with `{ id, name, screens, address }`
3. Future: UI for store management

### Add media
- **Via Dashboard:** Use the "Add Media by URL" section in the sidebar
- **Supported:** Any public image URL (Unsplash, Imgur, your own CDN, etc.)
- **For video:** Host on a CDN and add the direct URL

### Change rotation speed
- Per-screen setting in the admin dashboard (5s to 60s)

---

## License

MIT — Use freely for your franchise operations.
