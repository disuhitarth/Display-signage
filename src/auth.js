/**
 * Authentication Module
 * - JWT-based session tokens stored in httpOnly cookies
 * - bcrypt password hashing
 * - Default admin created on first run
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getData, setData } = require("./store");

// JWT secret — set via environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || "pizza-depot-signage-secret-change-me";
const TOKEN_EXPIRY = "7d";
const USERS_KEY = "users";

// ─── User Management ──────────────────────────────────────────────

async function getUsers() {
  return await getData(USERS_KEY, []);
}

async function initDefaultAdmin() {
  const users = await getUsers();
  if (users.length === 0) {
    // Create default admin account
    const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(defaultPassword, 10);
    const defaultAdmin = {
      id: "admin-1",
      username: "admin",
      passwordHash: hash,
      role: "admin",
      name: "Franchise Admin",
      createdAt: new Date().toISOString(),
    };
    await setData(USERS_KEY, [defaultAdmin]);
    console.log("[AUTH] Default admin created (username: admin, password: " + defaultPassword + ")");
    console.log("[AUTH] ⚠️  Change the default password after first login!");
  }
}

async function authenticateUser(username, password) {
  const users = await getUsers();
  let user = users.find((u) => u.username === username);

  // Fallback: If data storage failed to persist the default admin (Netlify Blobs issue),
  // we still allow 'admin' to login using the default initial password.
  const defaultPassword = process.env.ADMIN_PASSWORD || "admin123";
  if (!user && username === "admin") {
    if (password === defaultPassword) {
      user = {
        id: "admin-1",
        username: "admin",
        role: "admin",
        name: "Franchise Admin",
      };
    } else {
      return null;
    }
  } else if (user) {
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
  } else {
    return null;
  }

  // Generate JWT
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );

  return { token, user: { id: user.id, username: user.username, role: user.role, name: user.name } };
}

async function changePassword(userId, currentPassword, newPassword) {
  const users = await getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { error: "User not found" };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect" };

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await setData(USERS_KEY, users);
  return { ok: true };
}

// ─── Middleware ────────────────────────────────────────────────────

function authMiddleware(req, res, next) {
  // Check cookie first, then Authorization header
  let token = null;

  if (req.cookies && req.cookies.signage_token) {
    token = req.cookies.signage_token;
  } else if (req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
      token = parts[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Check if request has valid auth (for pages that redirect to login)
function checkAuth(req) {
  let token = null;
  if (req.cookies && req.cookies.signage_token) {
    token = req.cookies.signage_token;
  }
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

module.exports = {
  initDefaultAdmin,
  authenticateUser,
  changePassword,
  authMiddleware,
  checkAuth,
};
