/* Steven Gobran — portfolio interactions. Vanilla JS, no dependencies. */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  document.documentElement.classList.remove("no-js");

  /* ---------- Footer year ---------- */
  const year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Nav: background on scroll, hide on scroll down ---------- */
  const nav = $(".nav");
  let lastY = window.scrollY;
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 12);
    const menuOpen = document.body.classList.contains("menu-open");
    if (!menuOpen && y > 400 && y > lastY + 4) nav.classList.add("is-hidden");
    else if (y < lastY - 4 || y <= 400) nav.classList.remove("is-hidden");
    lastY = y;
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  // Keep the nav visible while keyboard focus is inside it.
  nav.addEventListener("focusin", () => nav.classList.remove("is-hidden"));

  /* ---------- Mobile menu ---------- */
  const toggle = $(".nav__toggle");
  const menu = $("#mobile-menu");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.classList.toggle("is-open", open);
    menu.inert = !open;
    document.body.classList.toggle("menu-open", open);
    if (open) nav.classList.remove("is-hidden");
    // keep keyboard and screen-reader focus inside the menu while it's open
    [$("main"), $(".footer"), ...$$(".nav__inner > :not(.nav__toggle)")].forEach((el) => { if (el) el.inert = open; });
    if (open) $("a", menu)?.focus();
  };
  if (toggle && menu) {
    menu.inert = true;
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) { setMenu(false); toggle.focus(); }
    });
    window.matchMedia("(min-width: 901px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });
  }

  /* ---------- Active nav link ---------- */
  const navLinks = $$(".nav__links a[href^='#']");
  const sections = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => {
          const on = a.getAttribute("href") === "#" + entry.target.id;
          a.classList.toggle("is-active", on);
          if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Reveal on scroll ---------- */
  const reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion.matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach((el) => io.observe(el));
    document.addEventListener("focusin", (e) => {
      const r = e.target.closest?.(".reveal:not(.is-visible)");
      if (r) { r.classList.add("is-visible"); io.unobserve(r); }
    });
  } else {
    reveals.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Hero entrance + typewriter ---------- */
  const hero = $(".hero");
  requestAnimationFrame(() => hero?.classList.add("is-ready"));

  const typed = $("#typed");
  if (typed) {
    const words = (typed.dataset.words || "").split("|").filter(Boolean);
    if (reduceMotion.matches || words.length < 2) {
      typed.textContent = words[0] || typed.textContent;
    } else {
      let w = 0, i = words[0].length, deleting = true, shown = 0;
      const maxWords = words.length * 2; // two passes, then rest on the first phrase
      typed.textContent = words[0];
      const tick = () => {
        const word = words[w];
        if (deleting) {
          i--;
          typed.textContent = word.slice(0, i);
          if (i === 0) { deleting = false; w = (w + 1) % words.length; return setTimeout(tick, 320); }
          return setTimeout(tick, 38);
        }
        const next = words[w];
        i++;
        typed.textContent = next.slice(0, i);
        if (i === next.length) {
          shown++;
          if (shown >= maxWords && w === 0) return;
          deleting = true;
          return setTimeout(tick, 2200);
        }
        return setTimeout(tick, 70);
      };
      setTimeout(tick, 2600);
    }
  }

  /* ---------- Dot-matrix portrait ----------
     Samples a small grayscale photo and draws each dark pixel as a dot.
     Dots fly in on load, get pushed away by the pointer, then spring home.
     The loop sleeps when nothing is moving and when the hero is off-screen. */
  const canvas = $("#portrait-canvas");
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext("2d");
    const src = new Image();
    src.decoding = "async";
    src.src = canvas.dataset.src;

    let dots = [];
    let w = 0, h = 0, dpr = 1;
    let pointer = { x: -9999, y: -9999, active: false };
    let running = false;
    let visible = true;
    let bursts = [];

    const ACCENT = [64, 224, 208];
    const BRIGHT = [190, 255, 248];

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cols = w < 360 ? 64 : w < 460 ? 82 : 96;
      const aspect = src.naturalHeight / src.naturalWidth;
      const rows = Math.round(cols * aspect);
      const off = document.createElement("canvas");
      off.width = cols; off.height = rows;
      const octx = off.getContext("2d", { willReadFrequently: true });
      octx.drawImage(src, 0, 0, cols, rows);
      const data = octx.getImageData(0, 0, cols, rows).data;

      const cell = Math.min(w / cols, h / rows);
      const ox = (w - cols * cell) / 2;
      const oy = (h - rows * cell) / 2;
      const old = dots;
      dots = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const k = (y * cols + x) * 4;
          const lum = (data[k] * 0.299 + data[k + 1] * 0.587 + data[k + 2] * 0.114) / 255;
          let v = 1 - lum;                       // darkness: hair, camera, shirt
          v = (v - 0.28) / 0.72;                 // drop the light background
          const fadeBottom = Math.min(1, (rows - y) / (rows * 0.28));
          const fadeSides = Math.min(1, x / (cols * 0.08), (cols - x) / (cols * 0.08));
          v *= fadeBottom * fadeSides;
          if (v <= 0.06) continue;
          v = Math.min(1, v);
          const hx = ox + x * cell + cell / 2;
          const hy = oy + y * cell + cell / 2;
          const prev = old[dots.length];
          dots.push({
            hx, hy,
            x: prev ? prev.x : hx + (Math.random() - 0.5) * w * 1.4,
            y: prev ? prev.y : hy + (Math.random() - 0.5) * h * 1.4,
            vx: 0, vy: 0,
            r: Math.max(0.55, cell * 0.46 * Math.pow(v, 0.8)),
            a: 0.25 + v * 0.75,
            hot: v > 0.82 && Math.random() < 0.18,
          });
        }
      }
      if (reduceMotion.matches) dots.forEach((d) => { d.x = d.hx; d.y = d.hy; });
      wake();
    };

    const BUCKETS = 6;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const groups = Array.from({ length: BUCKETS * 2 }, () => []);
      for (const d of dots) {
        const b = Math.min(BUCKETS - 1, Math.floor(d.a * BUCKETS));
        groups[b + (d.hot ? BUCKETS : 0)].push(d);
      }
      groups.forEach((g, gi) => {
        if (!g.length) return;
        const hot = gi >= BUCKETS;
        const alpha = ((gi % BUCKETS) + 0.5) / BUCKETS;
        const c = hot ? BRIGHT : ACCENT;
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
        ctx.beginPath();
        for (const d of g) { ctx.moveTo(d.x + d.r, d.y); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); }
        ctx.fill();
      });
    };

    const step = () => {
      if (!running) return;
      const R = Math.max(60, w * 0.16);
      const R2 = R * R;
      let energy = 0;
      bursts = bursts.filter((b) => (b.t += 1) < 26);
      for (const d of dots) {
        let fx = (d.hx - d.x) * 0.055;
        let fy = (d.hy - d.y) * 0.055;
        if (pointer.active) {
          const dx = d.x - pointer.x, dy = d.y - pointer.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < R2 && dist2 > 0.01) {
            const dist = Math.sqrt(dist2);
            const f = (1 - dist / R) * 2.4;
            fx += (dx / dist) * f; fy += (dy / dist) * f;
          }
        }
        for (const b of bursts) {
          const dx = d.x - b.x, dy = d.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ring = Math.abs(dist - b.t * 9);
          if (ring < 22) { const f = (1 - ring / 22) * 3.2; fx += (dx / dist) * f; fy += (dy / dist) * f; }
        }
        d.vx = (d.vx + fx) * 0.82;
        d.vy = (d.vy + fy) * 0.82;
        d.x += d.vx; d.y += d.vy;
        energy += Math.abs(d.vx) + Math.abs(d.vy) + Math.abs(d.hx - d.x) * 0.02 + Math.abs(d.hy - d.y) * 0.02;
      }
      draw();
      if (!pointer.active && !bursts.length && energy / (dots.length || 1) < 0.01) {
        dots.forEach((d) => { d.x = d.hx; d.y = d.hy; d.vx = d.vy = 0; });
        draw();
        running = false;
        return;
      }
      requestAnimationFrame(step);
    };

    function wake() {
      if (reduceMotion.matches) { draw(); return; }
      if (!running && visible) { running = true; requestAnimationFrame(step); }
    }

    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const p = toLocal(e);
      pointer.x = p.x; pointer.y = p.y; pointer.active = true;
      wake();
    });
    canvas.addEventListener("pointerleave", () => { pointer.active = false; wake(); });
    // Game mode: the pixel runner pushes the dots around when it crosses the portrait.
    canvas.addEventListener("game-poke", (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.detail.clientX - r.left; pointer.y = e.detail.clientY - r.top; pointer.active = true;
      wake();
    });
    canvas.addEventListener("game-poke-end", () => { pointer.active = false; wake(); });
    canvas.addEventListener("pointerdown", (e) => {
      if (reduceMotion.matches) return;
      const p = toLocal(e);
      bursts.push({ x: p.x, y: p.y, t: 0 });
      wake();
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) wake();
      }).observe(canvas);
    }

    let resizeTimer;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (src.complete && src.naturalWidth) build(); }, 120);
    });

    src.addEventListener("load", () => { build(); ro.observe(canvas); });
    if (src.complete && src.naturalWidth) { build(); ro.observe(canvas); }
  }

  /* ---------- Experience tabs (WAI-ARIA tabs pattern) ---------- */
  const tablist = $(".exp__tabs");
  if (tablist) {
    const tabs = $$("[role='tab']", tablist);
    const indicator = $(".exp__indicator", tablist);
    const vertical = window.matchMedia("(min-width: 901px)");

    const moveIndicator = (tab) => {
      if (!indicator) return;
      if (vertical.matches) {
        indicator.style.width = "2px";
        indicator.style.height = tab.offsetHeight + "px";
        indicator.style.transform = `translateY(${tab.offsetTop}px)`;
      } else {
        indicator.style.height = "2px";
        indicator.style.width = tab.offsetWidth + "px";
        indicator.style.transform = `translateX(${tab.offsetLeft}px)`;
      }
    };

    const select = (tab, focus = true) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute("aria-controls"));
        if (!panel) return;
        if (on) {
          panel.hidden = false;
          panel.classList.remove("is-entering");
          void panel.offsetWidth;
          panel.classList.add("is-entering");
        } else {
          panel.hidden = true;
        }
      });
      moveIndicator(tab);
      if (focus) tab.focus();
      if (!vertical.matches) tab.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion.matches ? "auto" : "smooth" });
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab, false));
      tab.addEventListener("keydown", (e) => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        let next = null;
        if (e.key in keys) next = tabs[(i + keys[e.key] + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); select(next); }
      });
    });

    const current = () => tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0];
    moveIndicator(current());
    const setOrientation = () => tablist.setAttribute("aria-orientation", vertical.matches ? "vertical" : "horizontal");
    setOrientation();
    vertical.addEventListener("change", () => { setOrientation(); moveIndicator(current()); });
    window.addEventListener("resize", () => moveIndicator(current()), { passive: true });
    document.fonts?.ready.then(() => moveIndicator(current()));
  }

  /* ---------- Spotlight carousel ---------- */
  const wrap = $(".spotlight-wrap");
  if (wrap) {
    const track = $(".spotlight__track", wrap);
    const slides = $$(".slide", wrap);
    const dotsEls = $$(".spotlight__dot", wrap);
    const live = $(".spotlight__live", wrap);
    const SLIDE_MS = 7000;
    wrap.style.setProperty("--slide-ms", SLIDE_MS + "ms");
    let index = 0;
    let timer = null;
    let paused = false;      // hover / focus pause
    let userPaused = false;  // pause button, or the visitor has touched the carousel
    let inView = false;
    const pauseBtn = $(".spotlight__pause", wrap);
    const dialogOpen = () => !!document.querySelector("dialog[open]");
    // Phones/tablets: slides stack (image over text) and have different heights,
    // so the carousel sizes itself to the current slide and doesn't auto-advance.
    const stacked = window.matchMedia("(max-width: 900px)");
    const syncHeight = () => {
      track.style.height = stacked.matches ? slides[index].offsetHeight + "px" : "";
    };

    const go = (n, user = false) => {
      index = (n + slides.length) % slides.length;
      track.style.transform = `translateX(${-index * 100}%)`;
      syncHeight();
      slides.forEach((s, i) => {
        const on = i === index;
        s.setAttribute("aria-hidden", String(!on));
        s.inert = !on;
      });
      dotsEls.forEach((d, i) => {
        // restart the progress bar animation
        d.removeAttribute("aria-current");
        if (i === index) { void d.offsetWidth; d.setAttribute("aria-current", "true"); }
      });
      if (user && live) live.textContent = `Project ${index + 1} of ${slides.length}: ${$(".slide__title", slides[index])?.textContent || ""}`;
      schedule();
    };

    const stopped = () => reduceMotion.matches || stacked.matches || paused || userPaused || !inView || dialogOpen();
    const schedule = () => {
      clearTimeout(timer);
      wrap.classList.toggle("is-paused", stopped());
      if (stopped()) return;
      timer = setTimeout(() => go(index + 1), SLIDE_MS);
    };

    const setPaused = (p) => { paused = p; schedule(); };
    const setUserPaused = (p) => {
      userPaused = p;
      if (pauseBtn) {
        pauseBtn.setAttribute("aria-pressed", String(p));
        $("use", pauseBtn)?.setAttribute("href", p ? "#i-play" : "#i-pause");
      }
      schedule();
    };
    if (reduceMotion.matches) setUserPaused(true);

    $(".spotlight__prev", wrap)?.addEventListener("click", () => go(index - 1, true));
    $(".spotlight__next", wrap)?.addEventListener("click", () => go(index + 1, true));
    dotsEls.forEach((d, i) => d.addEventListener("click", () => go(i, true)));
    pauseBtn?.addEventListener("click", () => setUserPaused(!userPaused));

    wrap.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") setPaused(true); });
    wrap.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") setPaused(false); });
    // Phones have no hover: once someone touches the carousel, stop auto-advancing for good.
    wrap.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse" && !userPaused) setUserPaused(true); });
    wrap.addEventListener("focusin", () => setPaused(true));
    wrap.addEventListener("focusout", (e) => {
      const to = e.relatedTarget;
      if (to && (wrap.contains(to) || to.closest?.("dialog"))) return; // focus moved into a dialog opened from a slide
      setPaused(false);
    });
    // Arrow keys only on the slide picker, so focus inside a slide is never lost.
    wrap.addEventListener("keydown", (e) => {
      if (e.target.closest(".spotlight__dots, .spotlight__arrows")) {
        if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1, true); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1, true); }
      }
    });
    document.getElementById("modal")?.addEventListener("close", () => setTimeout(schedule, 0));

    // Swipe on touch screens
    let sx = 0, sy = 0, swiping = false;
    track.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true; }, { passive: true });
    track.addEventListener("touchend", (e) => {
      if (!swiping) return;
      swiping = false;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(index + (dx < 0 ? 1 : -1), true);
    }, { passive: true });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        if (inView) go(index); else schedule();
      }, { threshold: 0.35 }).observe(wrap);
    }
    stacked.addEventListener("change", () => { syncHeight(); schedule(); });
    if ("ResizeObserver" in window) new ResizeObserver(syncHeight).observe(wrap);
    document.fonts?.ready.then(syncHeight);
    go(0);
  }

  /* ---------- Project filters + show more ---------- */
  const grid = $("#project-grid");
  if (grid) {
    const cards = $$(".card", grid);
    const filters = $$(".filter");
    const moreBtn = $("#show-more");
    const count = $("#project-count");
    const limit = () => (window.matchMedia("(max-width: 640px)").matches ? 4 : 6);
    let filter = "all";
    let expanded = false;

    const render = (animate) => {
      const lim = limit();
      const matches = cards.filter((c) => filter === "all" || (c.dataset.area || "").split(" ").includes(filter));
      cards.forEach((c) => { c.hidden = true; c.classList.remove("is-filtered-in"); });
      matches.forEach((c, i) => {
        const show = expanded || i < lim;
        c.hidden = !show;
        if (show && animate && !reduceMotion.matches) {
          c.style.animationDelay = Math.min(i, 8) * 45 + "ms";
          c.classList.add("is-filtered-in");
        }
      });
      if (moreBtn) {
        moreBtn.hidden = matches.length <= lim;
        moreBtn.setAttribute("aria-expanded", String(expanded));
        $(".label", moreBtn).textContent = expanded ? "Show less" : `Show all ${matches.length}`;
      }
      if (count) count.textContent = `${matches.length} project${matches.length === 1 ? "" : "s"}`;
    };

    filters.forEach((btn) => btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      expanded = false;
      filters.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      render(true);
    }));
    moreBtn?.addEventListener("click", () => {
      const wasExpanded = expanded;
      expanded = !expanded;
      render(!wasExpanded);
      if (wasExpanded) $("#more-projects")?.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
    });
    render(false);
  }

  /* ---------- YouTube: lightweight facade + playlist ---------- */
  const player = $("#player");
  if (player) {
    const items = $$(".pl-item");
    const facade = () => $(".yt-facade", player);

    const embed = (id, title) => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
      iframe.title = title || "YouTube video";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allowFullscreen = true;
      const hadFocus = player.contains(document.activeElement);
      player.replaceChildren(iframe);
      if (hadFocus) iframe.focus(); // keep keyboard users on the player
    };

    const setFacade = (item) => {
      const { id, title, meta, thumb } = item.dataset;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "yt-facade";
      btn.dataset.id = id;
      btn.dataset.title = title;
      btn.setAttribute("aria-label", `Play video: ${title}`);
      btn.innerHTML = `
        <img src="${thumb}" alt="" width="960" height="540">
        <span class="yt-play" aria-hidden="true"><svg class="icon"><use href="#i-play"/></svg></span>
        <span class="yt-caption"><strong></strong><span></span></span>`;
      $("strong", btn).textContent = title;
      $(".yt-caption span", btn).textContent = meta;
      player.replaceChildren(btn);
    };

    player.addEventListener("click", (e) => {
      const f = e.target.closest(".yt-facade");
      if (f) embed(f.dataset.id, f.dataset.title);
    });

    items.forEach((item) => item.addEventListener("click", () => {
      items.forEach((i) => i.setAttribute("aria-current", String(i === item)));
      const wasPlaying = !facade();
      if (wasPlaying) embed(item.dataset.id, item.dataset.title);
      else setFacade(item);
      if (window.matchMedia("(max-width: 900px)").matches) player.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "center" });
    }));
  }

  /* ---------- Copy email ---------- */
  $$("[data-copy]").forEach((btn) => btn.addEventListener("click", async () => {
    const status = $("#copy-status");
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
      if (status) status.textContent = `Copied ${text} to your clipboard.`;
    } catch {
      if (status) status.textContent = text;
    }
    clearTimeout(btn._t);
    btn._t = setTimeout(() => { if (status) status.textContent = ""; }, 3500);
  }));

  /* ---------- Game mode (loads assets/js/game.js on first use) ---------- */
  const gameBtn = $("#game-toggle");
  if (gameBtn) {
    let loading = null;
    const loadGame = () => loading || (loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "assets/js/game.js";
      s.onload = () => resolve(window.SGGame);
      s.onerror = () => { loading = null; reject(new Error("game failed to load")); };
      document.head.appendChild(s);
    }));
    const toggleGame = async () => {
      try { (await loadGame()).toggle(); } catch { /* offline: leave the button as is */ }
    };
    gameBtn.addEventListener("click", () => {
      // desktop only (the button is also hidden by CSS on phones and touch screens)
      if (!window.matchMedia("(min-width: 901px) and (hover: hover) and (pointer: fine)").matches) return;
      toggleGame();
    });
    document.addEventListener("sg-game", (e) => {
      const on = e.detail.active;
      gameBtn.setAttribute("aria-pressed", String(on));
      gameBtn.classList.toggle("is-on", on);
      $(".game-toggle__label", gameBtn).textContent = on ? "exit game" : "game mode";
      if (on) nav.classList.remove("is-hidden");
    });
  }

  /* ---------- Modal: architecture diagrams + image lightbox ---------- */
  const modal = $("#modal");
  const modalBody = $("#modal-body");
  const modalTitle = $("#modal-title");
  const modalKicker = $("#modal-kicker");
  let lastTrigger = null;

  const openModal = (kicker, title) => {
    modalKicker.textContent = kicker;
    modalTitle.textContent = title;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "");
    document.body.classList.add("menu-open");
  };
  const closeModal = () => { if (modal.open) modal.close(); };

  if (modal) {
    $(".modal__close", modal).addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    modal.addEventListener("close", () => {
      document.body.classList.remove("menu-open");
      modalBody.replaceChildren();
      lastTrigger?.focus();
    });
  }

  // Mermaid is ~1 MB, so it is only fetched the first time someone opens a diagram.
  const MERMAID_URL = "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";
  let mermaidReady = null;
  const loadMermaid = () => {
    if (!mermaidReady) {
      mermaidReady = import(MERMAID_URL).then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          securityLevel: "strict",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          themeVariables: {
            darkMode: true,
            background: "#0f2238",
            primaryColor: "#16304d",
            primaryTextColor: "#e3ecf8",
            primaryBorderColor: "#40e0d0",
            lineColor: "#40e0d0",
            secondaryColor: "#10233a",
            tertiaryColor: "#0c1a2c",
            clusterBkg: "rgba(64,224,208,0.05)",
            clusterBorder: "rgba(148,180,220,0.35)",
            edgeLabelBackground: "#0f2238",
            fontSize: "14px",
          },
          // natural size: CSS scales it down on desktop and lets it scroll sideways on phones
          flowchart: { curve: "basis", htmlLabels: true, padding: 12, nodeSpacing: 36, rankSpacing: 44, useMaxWidth: false },
        });
        return mermaid;
      });
      mermaidReady.catch(() => { mermaidReady = null; });
    }
    return mermaidReady;
  };
  const svgCache = new Map();
  let renderCount = 0;

  const openArch = async (key) => {
    const tpl = document.getElementById("arch-" + key);
    if (!tpl) return;
    const frag = tpl.content.cloneNode(true);
    const source = $(".mermaid-src", frag)?.textContent || "";
    const caption = document.createElement("p");
    caption.className = "modal__caption";
    caption.textContent = tpl.dataset.caption || "";
    const box = document.createElement("div");
    box.className = "diagram-box is-loading";
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", `Architecture diagram: ${tpl.dataset.caption || tpl.dataset.title}`);
    box.textContent = "Rendering diagram…";
    const steps = $(".arch-steps", frag);
    const note = document.createElement("p");
    note.className = "modal__note";
    note.textContent = "Diagram written in Mermaid.js";
    modalBody.replaceChildren(caption, box, ...(steps ? [steps] : []), note);
    openModal("Architecture", tpl.dataset.title || "");

    try {
      let svg = svgCache.get(key);
      if (!svg) {
        const mermaid = await loadMermaid();
        await document.fonts?.ready;
        ({ svg } = await mermaid.render(`arch-svg-${key}-${++renderCount}`, source));
        svgCache.set(key, svg);
      }
      if (!box.isConnected) return;
      box.classList.remove("is-loading");
      box.innerHTML = svg; // produced by Mermaid with securityLevel "strict" from our own templates
    } catch (err) {
      if (!box.isConnected) return;
      box.classList.remove("is-loading");
      const pre = document.createElement("pre");
      pre.textContent = source;
      box.replaceChildren(pre);
      note.textContent = "Couldn't load Mermaid.js, so here is the diagram source.";
    }
  };

  const openLightbox = (trigger) => {
    const { lightbox: src, caption = "", verify, gallery } = trigger.dataset;
    const isCert = trigger.classList.contains("cert-card__media") || trigger.classList.contains("cert-tile");
    const nodes = [];
    let items = null;
    try { items = gallery ? JSON.parse(gallery) : null; } catch { items = null; }
    if (items && items.length) {
      const grid = document.createElement("div");
      grid.className = "lightbox-grid";
      items.forEach((it) => {
        const fig = document.createElement("figure");
        const img = document.createElement("img");
        img.className = "lightbox-img";
        img.src = it.src;
        img.alt = it.caption ? `Certificate: ${it.caption}` : "";
        img.loading = "lazy";
        const fc = document.createElement("figcaption");
        fc.textContent = it.caption || "";
        fig.append(img, fc);
        grid.appendChild(fig);
      });
      nodes.push(grid);
    } else {
      const img = document.createElement("img");
      img.className = "lightbox-img";
      img.src = src;
      img.alt = $("img", trigger)?.alt || (isCert ? `Certificate: ${caption}` : caption);
      nodes.push(img);
    }
    const cap = document.createElement("p");
    cap.className = "lightbox-cap";
    cap.textContent = caption;
    nodes.push(cap);
    if (verify) {
      const a = document.createElement("a");
      a.className = "btn btn--sm";
      a.href = verify;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Verify credential";
      const wrap = document.createElement("p");
      wrap.className = "lightbox-actions";
      wrap.appendChild(a);
      nodes.push(wrap);
    }
    modalBody.replaceChildren(...nodes);
    const title = caption.split(isCert ? " · " : ": ")[0];
    openModal(isCert ? "Certificate" : "Screenshot", title);
  };

  document.addEventListener("click", (e) => {
    const arch = e.target.closest("[data-arch]");
    if (arch && modal) { e.preventDefault(); lastTrigger = arch; openArch(arch.dataset.arch); return; }
    const lb = e.target.closest("[data-lightbox]");
    if (lb && modal) { e.preventDefault(); lastTrigger = lb; openLightbox(lb); }
  });

  /* ---------- Equity curve: crosshair + tooltip ---------- */
  const eq = $("#equity");
  if (eq) {
    // Two SVGs share one tooltip: a full chart and a compact one for phones.
    const charts = $$("svg.eq-svg", eq).map((svg) => ({
      svg,
      hover: $(".eq-hover", svg),
      cross: $(".eq-cross", svg),
      dot: $(".eq-dot", svg),
      pts: JSON.parse(svg.dataset.points || "[]"),
    }));
    const tip = $(".eq-tip", eq);
    const plot = $(".equity__plot", eq);
    const fmt = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
    const visibleChart = () => charts.find((c) => c.svg.getClientRects().length) || charts[0];
    let current = -1;

    const show = (i, c = visibleChart()) => {
      const pts = c.pts;
      if (i < 0 || i >= pts.length) return;
      current = i;
      const [x, y, n, date, side, signal, pnl, cum] = pts[i];
      const { svg, hover, cross, dot } = c;
      hover.setAttribute("visibility", "visible");
      cross.setAttribute("x1", x); cross.setAttribute("x2", x);
      dot.setAttribute("cx", x); dot.setAttribute("cy", y);

      tip.replaceChildren();
      const strong = document.createElement("strong");
      strong.textContent = fmt(cum);
      const l1 = document.createElement("div");
      const key = document.createElement("span");
      key.className = "key";
      l1.append(key, document.createTextNode("Cumulative P&L"));
      const l2 = document.createElement("div");
      l2.className = "muted";
      l2.textContent = `Trade ${n} · ${date} · ${side} · ${signal.replace(/^(Long|Short) /, "")} ${fmt(pnl)}`;
      tip.append(strong, l1, l2);
      tip.hidden = false;

      // place the tooltip beside the point; if neither side fits, put it above or below
      const vb = svg.viewBox.baseVal;
      const W = plot.clientWidth, H = plot.clientHeight;
      const scale = W / vb.width;
      const px = x * scale, py = y * scale;
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      let left, top;
      if (px + 14 + tw <= W) { left = px + 14; top = py - th / 2; }
      else if (px - 14 - tw >= 0) { left = px - tw - 14; top = py - th / 2; }
      else {
        left = Math.min(Math.max(px - tw / 2, 0), W - tw);
        top = py - th - 14 >= 0 ? py - th - 14 : py + 14;
      }
      top = Math.max(0, Math.min(top, H - th));
      tip.style.transform = `translate(${Math.max(0, left)}px, ${top}px)`;
    };
    const hide = () => {
      charts.forEach((c) => c.hover.setAttribute("visibility", "hidden"));
      tip.hidden = true;
      current = -1;
    };

    const nearest = (c, clientX) => {
      const pt = c.svg.createSVGPoint();
      pt.x = clientX; pt.y = 0;
      const ctm = c.svg.getScreenCTM();
      if (!ctm) return -1;
      const vx = pt.matrixTransform(ctm.inverse()).x;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < c.pts.length; i++) {
        const d = Math.abs(c.pts[i][0] - vx);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    };

    charts.forEach((c) => {
      c.svg.addEventListener("pointermove", (e) => show(nearest(c, e.clientX), c));
      c.svg.addEventListener("pointerdown", (e) => show(nearest(c, e.clientX), c));
      // on touch, keep the tooltip after the finger lifts; tap elsewhere to dismiss
      c.svg.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hide(); });
    });
    document.addEventListener("pointerdown", (e) => { if (!tip.hidden && !eq.contains(e.target)) hide(); });
    eq.addEventListener("keydown", (e) => {
      const n = visibleChart().pts.length;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const start = current < 0 ? (e.key === "ArrowRight" ? -1 : n) : current;
        show(Math.max(0, Math.min(n - 1, start + (e.key === "ArrowRight" ? 1 : -1))));
      } else if (e.key === "Home") { e.preventDefault(); show(0); }
      else if (e.key === "End") { e.preventDefault(); show(n - 1); }
      else if (e.key === "Escape") hide();
    });
    eq.addEventListener("blur", hide);
  }

  /* ---------- Phone video: loads and plays only when on screen; pause + enlarge ---------- */
  $$(".phone__frame").forEach((frame) => {
    const video = $("video", frame);
    const btn = $(".phone__toggle", frame);
    const expand = $(".phone__expand", frame);
    if (!video || !btn) return;
    let userPaused = reduceMotion.matches;
    const sync = () => {
      const paused = video.paused;
      btn.setAttribute("aria-label", paused ? "Play video" : "Pause video");
      $("use", btn)?.setAttribute("href", paused ? "#i-play" : "#i-pause");
    };
    btn.addEventListener("click", () => {
      if (video.paused) { userPaused = false; video.play().catch(() => {}); }
      else { userPaused = true; video.pause(); }
    });
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) { if (!userPaused) video.play().catch(() => {}); }
        else video.pause();
      }, { threshold: 0.25 }).observe(video);
    }
    expand?.addEventListener("click", () => {
      if (!modal) return;
      lastTrigger = expand;
      video.pause();
      const big = document.createElement("video");
      big.className = "lightbox-video";
      big.muted = true; big.loop = true; big.playsInline = true; big.controls = true;
      big.poster = video.poster;
      big.setAttribute("aria-label", video.getAttribute("aria-label") || "Phone screen recording");
      $$("source", video).forEach((s) => big.appendChild(s.cloneNode()));
      const cap = document.createElement("p");
      cap.className = "lightbox-cap";
      cap.textContent = $("figcaption", frame.closest("figure"))?.textContent || "";
      modalBody.replaceChildren(big, cap);
      openModal("Trading agent", "Daily report on my phone");
      if (!reduceMotion.matches) big.play().catch(() => {});
    });
    sync();
  });
})();
