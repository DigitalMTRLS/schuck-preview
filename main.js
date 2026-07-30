/* ==========================================================================
   SCHUCK ELECTRIC — site behavior
   ========================================================================== */
(function () {
  "use strict";

  // Set immediately, before anything else can fail. The stylesheet only hides
  // .anim elements under html.js, so this is what licenses the scroll
  // animation to hide things at all. If this line never runs the page still
  // renders in full, just without the animation.
  document.documentElement.classList.add("js");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function boot() {
    // Page builders (GHL among them) inject custom HTML blocks after
    // DOMContentLoaded has already fired, so the markup may not exist the
    // first time this runs. Bail out and let the observer below retry.
    //
    // .site-header is the marker rather than any one feature: the page block
    // is injected as a single unit, so once the header is present the rest of
    // the markup is too. Testing for a feature that only some pages have
    // would boot early on the others.
    if (!document.querySelector(".site-header")) return false;
    if (document.documentElement.hasAttribute("data-se-booted")) return true;
    document.documentElement.setAttribute("data-se-booted", "");

    initStickyHeader();
    initMobileNav();
    initReveal();
    initHeroParallax();
    initCarousel();
    initChat();
    initDotSpotlight();
    initYear();
    return true;
  }

  function start() {
    if (boot()) return;

    // Markup wasn't there yet — watch for it, then boot once and stop.
    if (!("MutationObserver" in window)) {
      var tries = 0;
      var poll = setInterval(function () {
        if (boot() || ++tries > 40) clearInterval(poll);
      }, 150);
      return;
    }

    var observer = new MutationObserver(function () {
      if (boot()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Don't watch forever if the content never arrives.
    setTimeout(function () { observer.disconnect(); }, 15000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

  /* The announcement bar scrolls away; once it clears, the sticky header
     picks up its blurred/solid treatment. */
  function initStickyHeader() {
    var header = document.getElementById("siteHeader");
    var topbar = document.querySelector(".topbar");
    if (!header) return;

    var threshold = topbar ? topbar.offsetHeight - 2 : 20;
    var ticking = false;

    function update() {
      ticking = false;
      header.classList.toggle("is-stuck", window.scrollY >= threshold);
    }
    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      threshold = topbar ? topbar.offsetHeight - 2 : 20;
      update();
    });
  }

  function initMobileNav() {
    var toggle = document.getElementById("navToggle");
    var panel = document.getElementById("mobilePanel");
    var scrim = document.getElementById("mobileScrim");
    var close = document.getElementById("mobileClose");
    if (!toggle || !panel) return;

    function open() {
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      if (scrim) scrim.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("is-locked");
    }
    function shut() {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      if (scrim) scrim.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("is-locked");
    }

    toggle.addEventListener("click", open);
    if (close) close.addEventListener("click", shut);
    if (scrim) scrim.addEventListener("click", shut);
    panel.querySelectorAll("a, .js-open-chat").forEach(function (el) {
      el.addEventListener("click", shut);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) shut();
    });
  }

  /* Staggered fade/slide-in as elements enter the viewport. */
  function initReveal() {
    var items = document.querySelectorAll(".anim");
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var delay = parseInt(entry.target.getAttribute("data-delay") || "0", 10);
        setTimeout(function () { entry.target.classList.add("is-in"); }, delay);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -70px 0px" });

    items.forEach(function (el) { observer.observe(el); });
  }

  function initHeroParallax() {
    var layer = document.querySelector(".hero-bg");
    if (!layer || reduceMotion) return;

    var speed = parseFloat(layer.getAttribute("data-parallax")) || 0.18;
    var ticking = false;

    function apply() {
      ticking = false;
      if (window.innerWidth <= 768) { layer.style.transform = ""; return; }
      var y = window.scrollY * speed;
      layer.style.transform = "translate3d(0," + y.toFixed(1) + "px,0)";
    }
    function onScroll() {
      if (!ticking) { ticking = true; window.requestAnimationFrame(apply); }
    }
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", apply);
  }

  /* Services carousel — infinite loop. The track holds a clone set on each
     side of the originals, so partial cards always peek in from both edges.
     Arrows, dots, drag/swipe and arrow keys all drive the same goTo(). */
  function initCarousel() {
    var viewport = document.getElementById("serviceTrackViewport");
    var track = document.getElementById("serviceTrack");
    var dotsWrap = document.getElementById("serviceDots");
    if (!viewport || !track) return;

    var originals = Array.prototype.slice.call(track.children);
    var count = originals.length;
    if (!count) return;

    var lead = document.createDocumentFragment();
    var tail = document.createDocumentFragment();
    originals.forEach(function (card) {
      [lead, tail].forEach(function (frag) {
        var clone = card.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        frag.appendChild(clone);
      });
    });
    track.appendChild(tail);
    track.insertBefore(lead, track.firstChild);

    var prev = document.querySelector(".carousel-arrow--prev");
    var next = document.querySelector(".carousel-arrow--next");
    var index = count;      // position in the extended track
    var step = 0;
    var pad = 0;

    function measure() {
      var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
      step = originals[0].getBoundingClientRect().width + gap;
      var visible = Math.max(1, Math.floor((viewport.clientWidth + gap) / step));
      pad = (viewport.clientWidth - (visible * step - gap)) / 2;
    }

    function offsetFor(i) { return pad - i * step; }

    function paint(animate) {
      track.style.transition = animate ? "" : "none";
      track.style.transform = "translate3d(" + offsetFor(index).toFixed(2) + "px,0,0)";
      if (!animate) { void track.offsetWidth; track.style.transition = ""; }
      var real = ((index - count) % count + count) % count;
      if (dotsWrap) {
        Array.prototype.forEach.call(dotsWrap.children, function (dot, i) {
          dot.classList.toggle("is-active", i === real);
          dot.setAttribute("aria-selected", i === real ? "true" : "false");
        });
      }
    }

    // After an animated move that landed on a clone set, silently jump back
    // into the original range so the loop can continue forever.
    track.addEventListener("transitionend", function (e) {
      if (e.propertyName !== "transform") return;
      if (index >= count * 2) { index -= count; paint(false); }
      else if (index < count) { index += count; paint(false); }
    });

    function goTo(i) { index = i; paint(true); }

    function buildDots() {
      if (!dotsWrap || dotsWrap.children.length === count) return;
      dotsWrap.innerHTML = "";
      for (var i = 0; i < count; i++) {
        (function (i) {
          var b = document.createElement("button");
          b.className = "carousel-dot";
          b.type = "button";
          b.setAttribute("role", "tab");
          b.setAttribute("aria-label", "Go to slide " + (i + 1));
          b.addEventListener("click", function () { goTo(count + i); });
          dotsWrap.appendChild(b);
        })(i);
      }
    }

    if (prev) prev.addEventListener("click", function () { goTo(index - 1); });
    if (next) next.addEventListener("click", function () { goTo(index + 1); });

    // Drag / swipe
    var startX = 0, startOffset = 0, dragging = false, moved = 0;

    function onDown(e) {
      dragging = true;
      moved = 0;
      startX = (e.touches ? e.touches[0].clientX : e.clientX);
      startOffset = offsetFor(index);
      track.classList.add("is-dragging");
    }
    function onMove(e) {
      if (!dragging) return;
      moved = (e.touches ? e.touches[0].clientX : e.clientX) - startX;
      track.style.transform = "translate3d(" + (startOffset + moved) + "px,0,0)";
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      track.classList.remove("is-dragging");
      if (Math.abs(moved) > step * 0.18) goTo(index + (moved < 0 ? 1 : -1));
      else paint(true);
    }

    track.addEventListener("mousedown", function (e) { e.preventDefault(); onDown(e); });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    track.addEventListener("touchstart", onDown, { passive: true });
    track.addEventListener("touchmove", onMove, { passive: true });
    track.addEventListener("touchend", onUp);

    // A drag must not fire the click on whatever card ends up under the cursor
    track.addEventListener("click", function (e) {
      if (Math.abs(moved) > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    viewport.setAttribute("tabindex", "0");
    viewport.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(index + 1); }
      if (e.key === "ArrowLeft")  { e.preventDefault(); goTo(index - 1); }
    });

    function refresh() { measure(); buildDots(); paint(false); }
    refresh();
    window.addEventListener("resize", refresh);
    window.addEventListener("load", refresh);
  }

  /* Placeholder contact panel. To wire the real GHL chat widget: drop their
     embed script before </body> and call their open() method here instead. */
  function initChat() {
    var panel = document.getElementById("chatPanel");
    var scrim = document.getElementById("chatScrim");
    var close = document.getElementById("chatClose");
    if (!panel || !scrim) return;

    function open() {
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      scrim.classList.add("is-open");
      document.body.classList.add("is-locked");
    }
    function shut() {
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      scrim.classList.remove("is-open");
      document.body.classList.remove("is-locked");
    }

    document.querySelectorAll(".js-open-chat").forEach(function (btn) {
      btn.addEventListener("click", function (e) { e.preventDefault(); open(); });
    });
    if (close) close.addEventListener("click", shut);
    scrim.addEventListener("click", shut);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) shut();
    });
  }

  /* Dot spotlight — writes --mx/--my onto every .dot-spotlight inside a
     [data-spotlight] host so the bright lattice tracks the pointer, and flips
     --spot-opacity on enter/leave. Only two custom properties change, so
     nothing lays out; the mask does the rest. Skipped entirely under reduced
     motion or on a device with no hover, matching the CSS. */
  function initDotSpotlight() {
    if (reduceMotion || window.matchMedia("(hover: none)").matches) return;

    document.querySelectorAll("[data-spotlight]").forEach(function (root) {
      var layers = root.querySelectorAll(".dot-spotlight");
      if (!layers.length) return;

      var size = root.getAttribute("data-spot-size");
      if (size) {
        layers.forEach(function (el) { el.style.setProperty("--spot-size", size); });
      }

      var x = 0, y = 0, tx = 0, ty = 0, raf = 0, primed = false;

      function write() {
        var px = x.toFixed(1) + "px", py = y.toFixed(1) + "px";
        layers.forEach(function (el) {
          el.style.setProperty("--mx", px);
          el.style.setProperty("--my", py);
        });
      }

      function tick() {
        x += (tx - x) * 0.16;
        y += (ty - y) * 0.16;
        write();
        // Stop once we have caught up; the next pointermove restarts the loop.
        if (Math.abs(tx - x) < 0.3 && Math.abs(ty - y) < 0.3) {
          x = tx; y = ty;
          write();
          raf = 0;
          return;
        }
        raf = window.requestAnimationFrame(tick);
      }

      root.addEventListener("pointermove", function (e) {
        if (e.pointerType === "touch") return;
        var r = root.getBoundingClientRect();
        tx = e.clientX - r.left;
        ty = e.clientY - r.top;
        // First sample jumps, so the light does not sweep in from the corner.
        if (!primed) { primed = true; x = tx; y = ty; write(); }
        if (!raf) raf = window.requestAnimationFrame(tick);
      }, { passive: true });

      root.addEventListener("pointerenter", function (e) {
        if (e.pointerType === "touch") return;
        layers.forEach(function (el) { el.style.setProperty("--spot-opacity", 1); });
      }, { passive: true });

      root.addEventListener("pointerleave", function () {
        primed = false;
        if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
        layers.forEach(function (el) { el.style.setProperty("--spot-opacity", 0); });
      }, { passive: true });
    });
  }

  function initYear() {
    var el = document.querySelector("[data-year]");
    if (el) el.textContent = new Date().getFullYear();
  }
})();
