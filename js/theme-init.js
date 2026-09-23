// Runs in <head> before the page paints, so a saved theme never flashes.
// It also marks the page as "js" so scroll-reveal styles only apply with JavaScript.
(function () {
  document.documentElement.classList.add("js");
  try {
    var saved = localStorage.getItem("voting-system:theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }
  } catch (e) {
    /* Storage blocked: fall back to the system theme. */
  }
})();
