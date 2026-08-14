const monitorToggle = document.getElementById("monitorToggle");
const screenshotToggle = document.getElementById("screenshotToggle");
const statusPill = document.getElementById("statusPill");
const statusText = document.getElementById("statusText");
const eventList = document.getElementById("eventList");
const clearBtn = document.getElementById("clearBtn");
const openOptions = document.getElementById("openOptions");

function send(type, payload) {
  return chrome.runtime.sendMessage({ type, payload });
}

function renderStatus(settings) {
  monitorToggle.checked = !!settings.monitoringEnabled;
  screenshotToggle.checked = !!settings.captureScreenshots;
  statusPill.textContent = settings.monitoringEnabled ? "ON" : "OFF";
  statusPill.className = "pill " + (settings.monitoringEnabled ? "on" : "off");
  statusText.textContent = settings.monitoringEnabled ? "on" : "off";
}

function renderEvents(events) {
  eventList.innerHTML = "";
  if (events.length === 0) {
    eventList.innerHTML = "<li><span class='meta'>No activity logged yet.</span></li>";
    return;
  }
  for (const ev of events.slice(0, 30)) {
    const li = document.createElement("li");
    const time = new Date(ev.ts).toLocaleTimeString();
    li.innerHTML = `<span class="type">${ev.type}</span><span class="meta">${time} — ${ev.url || ""}</span>`;
    eventList.appendChild(li);
  }
}

async function init() {
  const settings = await send("GET_SETTINGS");
  renderStatus(settings);
  const events = await send("GET_RECENT_EVENTS");
  renderEvents(events || []);
}

monitorToggle.addEventListener("change", async () => {
  const settings = await send("SET_SETTINGS", { monitoringEnabled: monitorToggle.checked });
  renderStatus(settings);
});

screenshotToggle.addEventListener("change", async () => {
  const settings = await send("SET_SETTINGS", { captureScreenshots: screenshotToggle.checked });
  renderStatus(settings);
});

clearBtn.addEventListener("click", async () => {
  await send("CLEAR_EVENTS");
  renderEvents([]);
});

openOptions.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

init();
