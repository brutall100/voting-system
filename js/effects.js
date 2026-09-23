// Small interface effects: theme toggle, button ripples,
// scroll reveal, number count-up and toast messages.
(function () {
  "use strict";

  const THEME_KEY = "voting-system:theme";
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

  // ---------- Theme ----------

  const toggle = document.getElementById("themeToggle");

  function currentTheme() {
    return root.dataset.theme || (systemDark.matches ? "dark" : "light");
  }

  function paintToggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    toggle.setAttribute("aria-label", `Switch to ${next} theme`);
    toggle.title = `Switch to ${next} theme`;
  }

  toggle.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      /* storage blocked */
    }
    paintToggle();
  });
  systemDark.addEventListener("change", paintToggle);
  paintToggle();

  // ---------- Ripple ----------

  document.addEventListener("pointerdown", (event) => {
    const button = event.target.closest(".btn, .theme-toggle");
    if (!button || button.disabled || reduceMotion.matches) return;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    button.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  });

  // ---------- Scroll reveal ----------

  const revealer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                revealer.unobserve(entry.target);
              }
            }
          },
          { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
        )
      : null;

  function reveal(elements) {
    for (const el of elements) {
      if (revealer && !reduceMotion.matches) revealer.observe(el);
      else el.classList.add("is-visible");
    }
  }
  reveal(document.querySelectorAll(".reveal"));

  // ---------- Count-up ----------

  function countTo(element, target) {
    const start = Number(element.dataset.value || 0);
    element.dataset.value = target;
    if (reduceMotion.matches || start === target) {
      element.textContent = target;
      return;
    }
    const duration = 700;
    const startTime = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      element.textContent = Math.round(start + (target - start) * eased);
      if (t < 1 && element.dataset.value == target) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // ---------- Toast ----------

  const toast = document.getElementById("toast");
  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-shown"), 3200);
  }

  // ---------- Flying ballot (vote cast) ----------

  function flyBallot(fromButton, toElement) {
    if (reduceMotion.matches) return;
    const from = fromButton.getBoundingClientRect();
    const to = toElement.getBoundingClientRect();
    const slip = document.createElement("span");
    slip.className = "flying-slip";
    slip.style.left = `${from.left + from.width / 2 - 11}px`;
    slip.style.top = `${from.top + from.height / 2 - 14}px`;
    slip.style.setProperty("--dx", `${to.left + to.width / 2 - (from.left + from.width / 2)}px`);
    slip.style.setProperty("--dy", `${to.top + to.height / 2 - (from.top + from.height / 2)}px`);
    document.body.appendChild(slip);
    slip.addEventListener("animationend", () => slip.remove());
  }

  window.VotingEffects = { reveal, countTo, showToast, flyBallot, reduceMotion };
})();
