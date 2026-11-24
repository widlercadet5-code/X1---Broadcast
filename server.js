require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStoreFactory = require("connect-sqlite3");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const dbPath = process.env.DB_PATH || path.join(__dirname, "data", "x1-broadcast.sqlite");
const sessionDir = process.env.SESSION_DB_DIR || path.dirname(dbPath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(sessionDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
CREATE TABLE IF NOT EXISTS members (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 phone TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admins (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL
);
`);

const adminUser = process.env.ADMIN_USERNAME || "admin";
const adminPass = process.env.ADMIN_PASSWORD;
if (!adminPass) {
  console.warn("WARNING: ADMIN_PASSWORD is missing. Configure it in Render before public launch.");
} else {
  const existing = db.prepare("SELECT id FROM admins WHERE username=?").get(adminUser);
  if (!existing) {
    db.prepare("INSERT INTO admins(username,password_hash) VALUES(?,?)")
      .run(adminUser, bcrypt.hashSync(adminPass, 12));
    console.log(`Created initial admin account: ${adminUser}`);
  } else {
    console.log("Admin account already exists; environment password will not overwrite it.");
  }
}

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(express.json({ limit: "20kb" }));

const SQLiteStore = SQLiteStoreFactory(session);
app.use(session({
  store: new SQLiteStore({
    db: "sessions.sqlite",
    dir: sessionDir,
    concurrentDB: true
  }),
  secret: process.env.SESSION_SECRET || "development-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public")));

const registerLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const adminOnly = (req, res, next) => req.session.admin ? next() : res.status(401).json({ error: "Ou dwe konekte kòm administratè." });

function cleanPhone(v) { return String(v || "").replace(/[^\d+]/g, ""); }

app.post("/api/register", registerLimiter, (req, res) => {
  const name = String(req.body.name || "").trim().replace(/\s+/g, " ");
  const phone = cleanPhone(req.body.phone);
  const consent = req.body.consent === true || req.body.consent === "on";
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Antre yon non ki valab." });
  if (!/^\+?[0-9]{7,15}$/.test(phone)) return res.status(400).json({ error: "Nimewo telefòn nan pa valab. Mete kòd peyi a." });
  if (!consent) return res.status(400).json({ error: "Ou dwe bay konsantman ou anvan enskripsyon." });
  try {
    const result = db.prepare("INSERT INTO members(name,phone) VALUES(?,?)").run(name, phone);
    res.json({ ok: true, message: "Enskripsyon ou reyisi. Mèsi!", id: result.lastInsertRowid });
  } catch (e) {
    if (String(e.code).includes("CONSTRAINT")) return res.status(409).json({ error: "Nimewo sa deja enskri." });
    res.status(500).json({ error: "Gen yon pwoblèm. Eseye ankò." });
  }
});

app.post("/api/admin/login", loginLimiter, (req, res) => {
  const row = db.prepare("SELECT * FROM admins WHERE username=?").get(String(req.body.username || ""));
  if (!row || !bcrypt.compareSync(String(req.body.password || ""), row.password_hash))
    return res.status(401).json({ error: "Non itilizatè oswa modpas pa kòrèk." });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Pa kapab ouvri sesyon." });
    req.session.admin = row.username;
    req.session.save(saveErr => {
      if (saveErr) return res.status(500).json({ error: "Pa kapab konsève sesyon an." });
      res.json({ ok: true });
    });
  });
});

app.post("/api/admin/logout", adminOnly, (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get("/api/admin/me", adminOnly, (req, res) => res.json({ username: req.session.admin }));

app.get("/api/admin/stats", adminOnly, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) n FROM members").get().n;
  const today = db.prepare("SELECT COUNT(*) n FROM members WHERE date(created_at)=date('now')").get().n;
  const month = db.prepare("SELECT COUNT(*) n FROM members WHERE strftime('%Y-%m',created_at)=strftime('%Y-%m','now')").get().n;
  const recent = db.prepare("SELECT id,name,phone,created_at FROM members ORDER BY id DESC LIMIT 100").all();
  const daily = db.prepare("SELECT date(created_at) day, COUNT(*) count FROM members GROUP BY date(created_at) ORDER BY day DESC LIMIT 14").all().reverse();
  res.json({ total, today, month, recent, daily });
});

app.get("/api/admin/members", adminOnly, (req, res) => {
  const q = String(req.query.q || "").trim();
  const rows = q
    ? db.prepare("SELECT id,name,phone,created_at FROM members WHERE name LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT 500").all("%" + q + "%", "%" + q + "%")
    : db.prepare("SELECT id,name,phone,created_at FROM members ORDER BY id DESC LIMIT 500").all();
  res.json(rows);
});

app.delete("/api/admin/members/:id", adminOnly, (req, res) => {
  const result = db.prepare("DELETE FROM members WHERE id=?").run(Number(req.params.id));
  res.json({ ok: result.changes > 0 });
});

app.get("/api/admin/export.vcf", adminOnly, (req, res) => {
  const rows = db.prepare("SELECT name,phone FROM members ORDER BY id ASC").all();
  const esc = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  const cards = rows.map(r => {
    const full = "X1 " + r.name;
    return ["BEGIN:VCARD", "VERSION:3.0", `FN:${esc(full)}`, `N:${esc(full)};;;;`, `TEL;TYPE=CELL:${r.phone}`, "END:VCARD"].join("\r\n");
  });
  res.setHeader("Content-Type", "text/vcard; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="X1_Broadcast_Contacts.vcf"');
  res.send(cards.join("\r\n") + (cards.length ? "\r\n" : ""));
});

app.get("/health", (req, res) => res.json({ ok: true }));
const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => console.log(`X1 Broadcast running on port ${port}`));
