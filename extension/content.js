// content.js
// Intentionally minimal & privacy-conscious:
//  - Reports coarse interaction signals only (a click happened, a form was focused).
//  - Never reads or transmits input VALUES, page text, or keystrokes.
// Extend with care: anything added here runs on every page the user visits.

function report(type, extra = {}) {
  try {
    chrome.runtime.sendMessage({ type: "CONTENT_EVENT", payload: { type, ...extra } });
  } catch (_) {
    // Extension context may be invalidated during reload; ignore.
  }
}

document.addEventListener(
  "click",
  (e) => {
    const el = e.target;
    report("click", {
      tag: el?.tagName || null,
      // Only structural info, never innerText/value.
      isLink: el?.tagName === "A",
      isButton: el?.tagName === "BUTTON" || el?.type === "submit",
    });
  },
  { capture: true, passive: true }
);

document.addEventListener(
  "focusin",
  (e) => {
    const el = e.target;
    if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") {
      report("form_field_focus", { fieldType: el.type || "text" });
    }
  },
  { capture: true, passive: true }
);

report("content_script_loaded");
