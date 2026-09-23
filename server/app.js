// Express 5 app: JSON API under /api plus the static front-end.
const express = require("express");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const ROOT = path.join(__dirname, "..");
const VOTER_COOKIE = "voter_id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LIMITS = { question: 140, option: 60, minOptions: 2, maxOptions: 6 };

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

// Every browser gets an anonymous, random voter id in an httpOnly cookie.
// The database allows one vote per (poll, voter), so repeated clicks never add up.
function voterId(req, res, next) {
  let id = readCookie(req, VOTER_COOKIE);
  if (!id || !UUID_RE.test(id)) {
    id = randomUUID();
    res.cookie(VOTER_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
  }
  req.voterId = id;
  next();
}

function securityHeaders(req, res, next) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  next();
}

function cleanText(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function createApp(store) {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(express.json({ limit: "10kb" }));

  const api = express.Router();
  api.use(voterId);

  api.get("/health", (req, res) => {
    res.json({ ok: true, mode: "server" });
  });

  api.get("/polls", (req, res) => {
    res.json({ polls: store.listPolls(req.voterId) });
  });

  api.post("/polls", (req, res) => {
    const question = cleanText(req.body?.question, LIMITS.question);
    const rawOptions = Array.isArray(req.body?.options) ? req.body.options : [];
    const seen = new Set();
    const options = rawOptions
      .map((o) => cleanText(o, LIMITS.option))
      .filter((o) => o && !seen.has(o.toLowerCase()) && seen.add(o.toLowerCase()));

    if (!question) {
      return res.status(400).json({ error: "Please write a question." });
    }
    if (options.length < LIMITS.minOptions || options.length > LIMITS.maxOptions) {
      return res
        .status(400)
        .json({ error: `Add ${LIMITS.minOptions} to ${LIMITS.maxOptions} different options.` });
    }

    const id = store.createPoll(question, options);
    res.status(201).json({ poll: store.getPoll(id, req.voterId) });
  });

  api.put("/polls/:id/vote", (req, res) => {
    const optionId = Number(req.body?.optionId);
    if (!Number.isInteger(optionId)) {
      return res.status(400).json({ error: "Pick an option first." });
    }
    if (!store.pollExists(req.params.id)) {
      return res.status(404).json({ error: "Poll not found." });
    }
    if (!store.castVote(req.params.id, req.voterId, optionId)) {
      return res.status(400).json({ error: "This option is not part of the poll." });
    }
    res.json({ poll: store.getPoll(req.params.id, req.voterId) });
  });

  api.delete("/polls/:id/vote", (req, res) => {
    if (!store.pollExists(req.params.id)) {
      return res.status(404).json({ error: "Poll not found." });
    }
    store.removeVote(req.params.id, req.voterId);
    res.json({ poll: store.getPoll(req.params.id, req.voterId) });
  });

  api.use((req, res) => res.status(404).json({ error: "Not found." }));

  // eslint-disable-next-line no-unused-vars
  api.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON." });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server." });
  });

  app.use("/api", api);

  // Only the public front-end folders are served, never server/ or data/.
  for (const dir of ["css", "js", "images"]) {
    app.use(`/${dir}`, express.static(path.join(ROOT, dir)));
  }
  app.get("/", (req, res) => res.sendFile(path.join(ROOT, "index.html")));

  return app;
}

module.exports = { createApp, LIMITS };
