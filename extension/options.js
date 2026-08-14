const fields = ["backendUrl", "apiKey", "batchSize", "batchIntervalSec", "screenshotIntervalSec"];

function send(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}

async function load() {
  const settings = await send("GET_SETTINGS");
  for (const f of fields) {
    const el = document.getElementById(f);
    if (el) el.value = settings[f] ?? "";
  }
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  const payload = {};
  for (const f of fields) {
    const el = document.getElementById(f);
    if (!el) continue;
    payload[f] = el.type === "number" ? Number(el.value) : el.value;
  }
  await send("SET_SETTINGS", payload);
  const msg = document.getElementById("statusMsg");
  msg.textContent = "Saved.";
  setTimeout(() => (msg.textContent = ""), 1500);
});

load();
