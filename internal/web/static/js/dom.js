// DOM helpers. Data from the server is always written with textContent, never as HTML.

export const $ = (id) => document.getElementById(id);

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function setError(id, text) {
  $(id).hidden = !text;
  $(id).textContent = text || "";
}

// After an await the tap no longer counts as a user gesture, so window.open would be blocked:
// the page shows a link and the second tap opens it (the Claude app if the OS hands it the link).
export function setOpenLink(id, url) {
  $(id).hidden = !url;
  if (url) $(id).href = url;
}

const relative = new Intl.RelativeTimeFormat(navigator.language, { numeric: "auto" });

export function ago(iso, now = Date.now()) {
  const seconds = (new Date(iso) - now) / 1000;
  const units = [["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return relative.format(0, "minute");
}

// Grey placeholders shaped like the content that is on its way; screen readers get aria-busy instead.
export function skeleton(count, className, lines) {
  return Array.from({ length: count }, (_, index) => {
    const item = el("li", `skeleton ${typeof className === "function" ? className(index) : className}`);
    item.setAttribute("aria-hidden", "true");
    for (const width of lines) {
      const bar = el("span", "sk-line");
      bar.style.width = width;
      item.append(bar);
    }
    return item;
  });
}
