// device.js — assigns and persists a stable per-install device id,
// sent as X-Device-Id so events from the same browser can be grouped
// server-side without relying on IP or cookies.
async function getOrCreateDeviceId() {
  const { deviceId } = await chrome.storage.local.get("deviceId");
  if (deviceId) return deviceId;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ deviceId: id });
  return id;
}
