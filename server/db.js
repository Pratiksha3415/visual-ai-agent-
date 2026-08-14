import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, "events.db");

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    device_id TEXT,
    type TEXT NOT NULL,
    url TEXT,
    title TEXT,
    tab_id INTEGER,
    ts TEXT NOT NULL,
    raw_json TEXT NOT NULL,
    received_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
`);

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO events (id, device_id, type, url, title, tab_id, ts, raw_json)
  VALUES (@id, @device_id, @type, @url, @title, @tab_id, @ts, @raw_json)
`);

export function insertEvents(events, deviceId) {
  const tx = db.transaction((rows) => {
    for (const ev of rows) {
      insertStmt.run({
        id: ev.id,
        device_id: deviceId || null,
        type: ev.type,
        url: ev.url || null,
        title: ev.title || null,
        tab_id: ev.tabId ?? null,
        ts: ev.ts,
        raw_json: JSON.stringify(ev),
      });
    }
  });
  tx(events);
}

export function queryEvents({ limit = 100, type, since } = {}) {
  let sql = "SELECT * FROM events WHERE 1=1";
  const params = {};
  if (type) {
    sql += " AND type = @type";
    params.type = type;
  }
  if (since) {
    sql += " AND ts >= @since";
    params.since = since;
  }
  sql += " ORDER BY ts DESC LIMIT @limit";
  params.limit = limit;
  return db.prepare(sql).all(params);
}
