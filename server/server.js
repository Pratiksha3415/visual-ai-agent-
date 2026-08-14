import "dotenv/config";
import express from "express";
import cors from "cors";
import { insertEvents, queryEvents } from "./db.js";

const app = express();
const PORT = process.env.PORT || 8787;
const API_KEY = process.env.API_KEY || ""; // set to require auth

app.use(cors());
app.use(express.json({ limit: "15mb" })); // screenshots as base64 can be sizeable

function requireAuth(req, res, next) {
  if (!API_KEY) return next(); // auth disabled if no key configured
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token !== API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/events", requireAuth, (req, res) => {
  const { events } = req.body || {};
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({ error: "events array required" });
  }
  const deviceId = req.headers["x-device-id"] || null;
  try {
    insertEvents(events, deviceId);
    res.json({ ok: true, count: events.length });
  } catch (err) {
    console.error("Failed to insert events:", err);
    res.status(500).json({ error: "internal error" });
  }
});

app.get("/events", requireAuth, (req, res) => {
  const { limit, type, since } = req.query;
  const rows = queryEvents({
    limit: limit ? Number(limit) : undefined,
    type,
    since,
  });
  res.json({ events: rows });
});

app.listen(PORT, () => {
  console.log(`visual-ai-agent server listening on http://localhost:${PORT}`);
  if (!API_KEY) {
    console.warn("WARNING: API_KEY not set — /events endpoints are unauthenticated. Set API_KEY in .env for real deployments.");
  }
});
