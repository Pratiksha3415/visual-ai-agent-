# Visual AI Agent — Browser Activity Monitor

A Chrome extension (Manifest V3) + backend service that logs browsing
activity — tab changes, navigation, optional periodic screenshots — and
stores it in a database, for a user who has knowingly installed and enabled
it on their own browser.

## ⚠️ Read this before deploying

This project **must only be used on browsers where the person using them
knows monitoring is active and has agreed to it** — your own browser,
a device you own, or a workplace device where monitoring is disclosed
per your local labor law. Installing this on someone else's device without
their knowledge (a partner, a family member, an employee not told about it)
is stalkerware/spyware and may be illegal in your jurisdiction.

The extension is built with that in mind:
- Monitoring is **off by default**. It only starts after the user flips
  the toggle in the popup.
- The toolbar badge always shows **ON**/**OFF** — there's no hidden mode.
- The popup shows a live log of exactly what has been captured, on-device.
- The content script never reads keystrokes, input values, or page text —
  only coarse signals like "a click happened" or "a text field was focused."

If your use case is enterprise fleet monitoring with its own disclosure
process, you can drop the popup toggle and hard-code `monitoringEnabled:
true`, but you're then responsible for whatever disclosure your
jurisdiction/policy requires.

## Architecture

```
extension/        Chrome MV3 extension (the agent)
  manifest.json
  background.js    tab/window/nav listeners, batching, upload to backend
  content.js       minimal in-page signals (click/focus), no text/keystrokes
  popup.html/js/css  on/off toggle + live local activity log
  options.html/js  backend URL / API key / batching config
  icons/

server/            Backend that receives and stores events
  server.js        Express app: POST /events, GET /events, GET /health
  db.js            SQLite (better-sqlite3) storage layer
  package.json
  .env.example
```

### Data flow
1. `background.js` listens to `chrome.tabs`, `chrome.windows`, and
   `chrome.webNavigation` events, plus messages forwarded from
   `content.js`.
2. Events are queued in memory, mirrored to `chrome.storage.local` (so the
   popup can show what's being sent), and flushed in batches to the
   backend URL configured in Options.
3. The backend validates the batch, dedupes by event id, and writes to
   SQLite (`server/events.db`).

## Setup

### 1. Backend

```bash
cd server
cp .env.example .env   # edit API_KEY to a real secret
npm install
npm start
# -> visual-ai-agent server listening on http://localhost:8787
```

### 2. Extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**, select the `extension/` folder
4. Click the extension icon → **Settings** (gear / options page) → set
   the backend URL (`http://localhost:8787/events`) and the same API key
   you put in `.env`
5. Click the toolbar icon and flip monitoring **on**

### 3. Verify

```bash
curl http://localhost:8787/events -H "Authorization: Bearer <your API_KEY>"
```

You should see events appear as you browse.

## Event types captured

| type | description |
|---|---|
| `tab_created` / `tab_activated` / `tab_updated` / `tab_closed` | tab lifecycle |
| `window_focus` / `window_blur` | browser window focus changes |
| `navigation` | top-frame page navigations completed |
| `click` | a click occurred (element tag only, no text/value) |
| `form_field_focus` | an input/textarea was focused (field type only) |
| `screenshot` | (opt-in) periodic JPEG of the active tab, base64-encoded |

## Extending

- Swap SQLite for Postgres/MySQL by replacing `server/db.js` — the
  `insertEvents`/`queryEvents` interface is the only thing `server.js`
  depends on.
- For screenshots at scale, upload the JPEG to object storage (S3/GCS)
  from `server.js` instead of storing base64 inline in SQLite.
- Add a dashboard by building against `GET /events`.

## License

MIT — see [LICENSE](./LICENSE).
