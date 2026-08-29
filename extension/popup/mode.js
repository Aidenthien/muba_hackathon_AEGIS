/**
 * Sizing mode, decided before the body paints.
 *
 * The toolbar-anchored panel takes its dimensions from the document, so the
 * stylesheet pins html to 380x600 (600 is Chrome's panel ceiling). When the
 * fallback standalone window is used instead, it should fill that window
 * rather than letterbox inside it.
 *
 * A classic script in <head> — not the module — so this lands before first
 * paint and there's no visible resize.
 */
if (new URLSearchParams(window.location.search).get("mode") === "window") {
  document.documentElement.classList.add("mode-window");
}
