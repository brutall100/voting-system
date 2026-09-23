// Live background: paper ballots with a tick drift up like leaves in warm air.
// Every ballot gets a random size, speed, delay, sway and spin, so the
// motion never looks mechanical. Only transform and opacity are animated.
(function () {
  "use strict";

  const layer = document.getElementById("ballots");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function build() {
    layer.textContent = "";
    if (reduceMotion.matches) return;

    const isSmall = window.matchMedia("(max-width: 640px)").matches;
    const count = isSmall ? 9 : 18;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const ballot = document.createElement("span");
      ballot.className = "floating-ballot";
      const duration = random(18, 34);
      ballot.style.setProperty("--x", `${random(0, 100).toFixed(1)}vw`);
      ballot.style.setProperty("--size", `${random(14, 34).toFixed(0)}px`);
      ballot.style.setProperty("--duration", `${duration.toFixed(1)}s`);
      // A negative delay starts every ballot somewhere along its path.
      ballot.style.setProperty("--delay", `${(-random(0, duration)).toFixed(1)}s`);
      ballot.style.setProperty("--sway", `${random(-14, 14).toFixed(1)}vw`);
      ballot.style.setProperty("--spin", `${random(-260, 260).toFixed(0)}deg`);
      ballot.style.setProperty("--alpha", random(0.35, 0.85).toFixed(2));
      if (Math.random() < 0.35) ballot.classList.add("floating-ballot--blank");
      fragment.appendChild(ballot);
    }
    layer.appendChild(fragment);
  }

  build();
  reduceMotion.addEventListener("change", build);

  let resizeTimer;
  let lastWidthIsSmall = window.innerWidth <= 640;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const small = window.innerWidth <= 640;
      if (small !== lastWidthIsSmall) {
        lastWidthIsSmall = small;
        build();
      }
    }, 250);
  });
})();
