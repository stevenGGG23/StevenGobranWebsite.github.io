/* Game mode.
   A pixel-art Steven drops onto a few glowing ledges, then runs, jumps and double-jumps across
   the page itself: headings, cards and charts are platforms, plus ledges down both sides.
   No objective. Fall off the bottom of the screen and the game ends. Loaded on demand by main.js. */
(() => {
  "use strict";
  if (window.SGGame) return;

  /* ---------- tuning (per 60 fps frame) ---------- */
  const GRAVITY = 0.52;
  const MAX_FALL = 14;
  const JUMP_V = -11.2;
  const AIR_JUMP_V = -10.2;
  const ACCEL = 0.85;
  const MAX_SPEED = 5.2;
  const FRICTION = 0.78;
  const AIR_CONTROL = 0.65;
  const COYOTE = 6;
  const BUFFER = 7;
  const SCALE = 3;
  const STEP_MS = 1000 / 60;
  const LEDGE_H = 4;

  /* ---------- sprite: 12 x 16 pixel art ---------- */
  const HEAD = [
    "...hHHHh....",
    "..HHhHHHHh..",
    ".HHHHHhHHHH.",
    ".HhHHHHHHhH.",
    ".HHSSSSSSHH.",
    "..SSESSESS..",
    "..SSSSSSSS..",
    "...SSssSS...",
  ];
  const FRAMES = {
    idle: HEAD.concat(["...TTTTTT...", "..TTTTTTTT..", ".StTTTTTTtS.", ".S.TTTTTT.S.", "...PPPPPP...", "...PP..PP...", "...PP..PP...", "..WWW..WWW.."]),
    run1: HEAD.concat(["...TTTTTT...", "..TTTTTTTT..", ".StTTTTTTtS.", "...TTTTTT...", "...PPPPPP...", "..PP....PP..", ".PP......PP.", ".WW......WW."]),
    run2: HEAD.concat(["...TTTTTT...", "..TTTTTTTT..", "..STTTTTTS..", "...TTTTTT...", "...PPPPPP...", "....PPPP....", "....PPPP....", "...WWWWWW..."]),
    jump: HEAD.concat(["S..TTTTTT..S", ".StTTTTTTtS.", "..TTTTTTTT..", "...TTTTTT...", "...PPPPPP...", "..PP....PP..", "..PP....PP..", "..WW....WW.."]),
  };
  const PALETTE = { H: "#5b3a24", h: "#8a5a38", S: "#e2a47e", s: "#c78664", E: "#0a1624", T: "#40e0d0", t: "#2bb3a6", P: "#2a3d5a", W: "#e3ecf8" };
  const W = 12 * SCALE;
  const H = 16 * SCALE;
  const FOOT_INSET = 9; // collision box is narrower than the sprite

  // Pre-render every frame (both facings) once, so drawing is a single drawImage call.
  const SPRITES = {};
  for (const [name, rows] of Object.entries(FRAMES)) {
    SPRITES[name] = [1, -1].map((face) => {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      const g = c.getContext("2d");
      rows.forEach((row, r) => {
        for (let col = 0; col < 12; col++) {
          const ch = row[col];
          if (ch === ".") continue;
          g.fillStyle = PALETTE[ch];
          g.fillRect((face < 0 ? 11 - col : col) * SCALE, r * SCALE, SCALE, SCALE);
        }
      });
      return c;
    });
  }

  /* ---------- page platforms ---------- */
  const PLATFORM_SEL = [
    ".status-pill", ".hero__title", ".hero__role", ".hero__cta", ".hero__art",
    ".section-title", ".subhead", ".about__text > p", ".tech-list", ".edu", ".edu__meta", ".portrait__frame",
    ".exp__tabs", ".exp__role", ".exp__panel:not([hidden]) .bullets li", ".exp__panel:not([hidden]) .tags",
    ".spotlight", ".spotlight__controls", ".filters", ".card:not([hidden])", ".more-wrap .btn",
    ".lede", ".phone__frame", ".bot", ".stats", ".equity", ".days", ".loop__head", ".loop-step",
    ".paper", ".paper__cover", ".desk-card", ".cert-card", ".cert-chips li",
    ".player", ".channel", ".pl-item", ".footer__inner",
  ].join(",");

  const docEl = document.documentElement;
  let S = null;

  function visible(el) {
    if (el.closest("[hidden], .nav, .mobile-menu, dialog, .game-ui")) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0.05;
  }

  function readPage() {
    const sx = window.scrollX, sy = window.scrollY;
    const vw = docEl.clientWidth;
    const dom = [];
    document.querySelectorAll(PLATFORM_SEL).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 6 || r.right < 0 || r.left > vw || !visible(el)) return;
      dom.push({ l: r.left + sx, r: r.right + sx, t: r.top + sy, el, dom: true });
    });
    const p = S.player;
    if (p.ground && p.ground.dom) {
      const same = dom.find((q) => q.el === p.ground.el);
      if (same) { p.y += same.t - p.ground.t; p.ground = same; }
    }
    S.dom = dom;
    S.docH = docEl.scrollHeight;
    S.docW = vw;
  }

  // Ledges down both side gutters so you can always climb or drop to the next thing.
  function buildLedges() {
    const vw = docEl.clientWidth;
    const docH = docEl.scrollHeight;
    const ledges = [];
    const w = vw < 600 ? 58 : 72;
    const span = Math.max(24, Math.min(110, (vw - 1120) / 2 - w));
    let i = 0;
    for (let y = 340; y < docH - 160; y += 150, i++) {
      const lx = 14 + ((i * 47) % (span + 1));
      const rx = vw - 14 - w - ((i * 31 + 40) % (span + 1));
      ledges.push({ l: lx, r: lx + w, t: y, a: 0 });
      ledges.push({ l: rx, r: rx + w, t: y + 75, a: 0 });
    }
    S.ledges = ledges;
  }

  // The little staircase that draws itself in when you spawn.
  function buildSpawn() {
    const vw = window.innerWidth;
    const navH = document.querySelector(".nav")?.getBoundingClientRect().bottom || 72;
    const top = window.scrollY + Math.max(0, navH);
    const base = Math.max(18, Math.min(vw * 0.08, 140));
    const step = Math.min(118, (vw - base - 40) / 4);
    const ys = [240, 180, 250, 190];
    S.spawn = ys.map((dy, k) => ({ l: base + k * step, r: base + k * step + 78, t: top + dy, a: 0, delay: k * 9, draw: 0 }));
  }

  /* ---------- UI ---------- */
  function buildUI() {
    const wrap = document.createElement("div");
    wrap.className = "game-ui";
    wrap.innerHTML = `
      <canvas class="game-canvas" aria-hidden="true"></canvas>
      <p class="game-hint" role="status"><kbd>←</kbd><kbd>→</kbd> move <kbd>space</kbd> jump · again to double jump <kbd>↓</kbd> drop <kbd>esc</kbd> exit</p>
      <p class="game-over" role="status" hidden>you fell</p>`;
    document.body.appendChild(wrap);
    S.ui = { wrap, canvas: wrap.querySelector(".game-canvas"), hint: wrap.querySelector(".game-hint"), over: wrap.querySelector(".game-over") };
    S.ctx = S.ui.canvas.getContext("2d");
    sizeCanvas();
    S.hintTimer = setTimeout(() => S && S.ui.hint.classList.add("is-faded"), 5000);
  }

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = S.ui.canvas;
    c.width = Math.round(window.innerWidth * dpr);
    c.height = Math.round(window.innerHeight * dpr);
    c.style.width = window.innerWidth + "px";
    c.style.height = window.innerHeight + "px";
    S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.ctx.imageSmoothingEnabled = false;
  }

  /* ---------- input ---------- */
  const KEYMAP = {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "jump", w: "jump", W: "jump", " ": "jump",
    ArrowDown: "down", s: "down", S: "down",
  };
  function press(k, isDown) {
    if (!S || S.dead) return;
    if (k === "jump" && isDown && !S.keys.jump) S.jumpBuffer = BUFFER;
    if (k === "down" && isDown && !S.keys.down) S.dropFrames = 14;
    S.keys[k] = isDown;
  }
  function onKey(e) {
    if (!S) return;
    if (e.key === "Escape") { e.preventDefault(); stop(); return; }
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    const k = KEYMAP[e.key];
    if (!k) return;
    e.preventDefault();
    e.stopPropagation(); // keep the carousel/tabs from reacting to game keys
    press(k, e.type === "keydown");
  }
  function onBlur() { if (S) S.keys = { left: false, right: false, jump: false, down: false }; }

  /* ---------- simulation ---------- */
  function platforms() {
    return S.dom.concat(S.ledges.filter((q) => q.a > 0.2), S.spawn.filter((q) => q.draw >= 1));
  }

  function step() {
    const p = S.player;
    const k = S.keys;
    S.frame++;

    // spawn ledges draw in one after another, then the player drops onto the first
    S.spawn.forEach((q) => {
      if (S.frame > q.delay) { q.draw = Math.min(1, q.draw + 0.09); q.a = Math.min(1, q.a + 0.08); }
    });
    if (!p.live) {
      if (S.frame > 30) { p.live = true; p.vy = 2; }
      else return;
    }

    const dir = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const control = p.ground ? 1 : AIR_CONTROL;
    if (dir) { p.vx += dir * ACCEL * control; p.face = dir; }
    else p.vx *= p.ground ? FRICTION : 0.96;
    p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
    if (Math.abs(p.vx) < 0.05) p.vx = 0;

    // jumping: coyote time, buffered presses and one air jump
    if (S.jumpBuffer > 0) {
      if (p.ground || p.sinceGround <= COYOTE) {
        p.vy = JUMP_V; p.ground = null; p.sinceGround = 99; S.jumpBuffer = 0;
        p.stretch = 1;
        dust(p.x + W / 2, p.y + H, 5, 0.5);
      } else if (p.airJumps > 0) {
        p.vy = AIR_JUMP_V; p.airJumps--; S.jumpBuffer = 0;
        p.stretch = 1;
        S.rings.push({ x: p.x + W / 2, y: p.y + H, r: 4, life: 18 });
      }
    }
    if (S.jumpBuffer > 0) S.jumpBuffer--;
    if (!k.jump && p.vy < -3.5) p.vy *= 0.62; // short hop when jump is released early

    // drop through whatever you're standing on
    if (S.dropFrames > 0) {
      if (p.ground && p.ground !== "floor") { S.ignore = p.ground; p.ground = null; p.y += 2; }
      S.dropFrames--;
    } else S.ignore = null;

    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
    const prevFeet = p.y + H;
    p.x += p.vx;
    p.y += p.vy;
    p.x = Math.max(2, Math.min(S.docW - W - 2, p.x));

    const feet = p.y + H;
    const fl = p.x + FOOT_INSET, fr = p.x + W - FOOT_INSET;
    let landed = null;
    if (p.vy >= 0) {
      for (const pl of platforms()) {
        if (pl === S.ignore || fr < pl.l || fl > pl.r) continue;
        if (prevFeet <= pl.t + 1 && feet >= pl.t && (!landed || pl.t < landed.t)) landed = pl;
      }
      if (!landed && feet >= S.docH - 2) landed = "floor";
    }
    if (landed) {
      const impact = p.vy;
      p.y = (landed === "floor" ? S.docH - 2 : landed.t) - H;
      p.vy = 0;
      if (!p.ground) { p.squash = Math.min(1, impact / 12); if (impact > 7) dust(p.x + W / 2, p.y + H, 7, 0.7); }
      p.ground = landed; p.sinceGround = 0; p.airJumps = 1;
    } else if (p.ground && p.ground !== "floor") {
      const g = p.ground;
      if (fr < g.l || fl > g.r || Math.abs(feet - g.t) > 2) p.ground = null; // walked off the edge
    }
    if (!p.ground) p.sinceGround++;

    // a little dust while running
    if (p.ground && Math.abs(p.vx) > 3.5 && S.frame % 7 === 0) dust(p.x + W / 2 - p.face * 10, p.y + H, 1, 0.3);

    p.squash *= 0.82;
    p.stretch *= 0.85;
    for (const d of S.particles) { d.x += d.vx; d.y += d.vy; d.vy += 0.15; d.life--; }
    S.particles = S.particles.filter((d) => d.life > 0);
    for (const r of S.rings) { r.r += 1.6; r.life--; }
    S.rings = S.rings.filter((r) => r.life > 0);

    // ledges fade in once they're on screen
    const top = window.scrollY, bottom = top + window.innerHeight;
    for (const q of S.ledges) if (q.t > top - 40 && q.t < bottom + 80) q.a = Math.min(1, q.a + 0.06);

    // fell off the bottom of the screen: game over
    if (!p.ground && p.y - window.scrollY > window.innerHeight + 30) die();

    if (S.frame % 45 === 0) readPage();
  }

  function dust(x, y, n, power) {
    if (S.reduce) return;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + Math.random() * Math.PI;
      const v = (0.6 + Math.random() * 1.8) * power;
      S.particles.push({ x, y, vx: Math.cos(a) * v * 1.6, vy: Math.sin(a) * v, life: 16 + (Math.random() * 14) | 0 });
    }
  }

  // Camera: re-centers smoothly after you land, follows you up, but lags behind long falls.
  function camera() {
    const p = S.player;
    if (!p.live) return;
    const vh = window.innerHeight;
    const top = window.scrollY;
    const cy = p.y + H / 2 - top;
    let dy = 0;
    if (p.ground) {
      if (cy > vh * 0.62) dy = (cy - vh * 0.5) * 0.1;
      else if (cy < vh * 0.3) dy = (cy - vh * 0.42) * 0.1;
    } else if (cy < vh * 0.22) dy = (cy - vh * 0.3) * 0.2;
    else if (cy > vh * 0.68) dy = Math.min(5.5, (cy - vh * 0.68) * 0.12);
    if (Math.abs(dy) > 0.25) window.scrollTo(window.scrollX, Math.max(0, top + dy));
  }

  function pokePortrait() {
    const c = document.getElementById("portrait-canvas");
    if (!c) return;
    const r = c.getBoundingClientRect();
    const p = S.player;
    const x = p.x - window.scrollX + W / 2, y = p.y - window.scrollY + H / 2;
    const inside = p.live && x > r.left - 20 && x < r.right + 20 && y > r.top - 30 && y < r.bottom + 20;
    if (inside) c.dispatchEvent(new CustomEvent("game-poke", { detail: { clientX: x, clientY: y + H / 2 } }));
    else if (S.poking) c.dispatchEvent(new CustomEvent("game-poke-end"));
    S.poking = inside;
  }

  /* ---------- drawing ---------- */
  function line(ctx, l, r, y, alpha, draw = 1) {
    if (alpha <= 0) return;
    const len = (r - l) * draw;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#40e0d0";
    ctx.shadowColor = "rgba(64,224,208,.7)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(l, y, len, LEDGE_H, 2);
    else ctx.rect(l, y, len, LEDGE_H);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function draw() {
    const ctx = S.ctx;
    const ox = window.scrollX, oy = window.scrollY;
    const vw = window.innerWidth, vh = window.innerHeight;
    ctx.clearRect(0, 0, vw, vh);
    const p = S.player;
    const px = p.x + W / 2, py = p.y + H;

    // page platforms near you light up so you can see where you can land
    if (p.live) {
      ctx.fillStyle = "#40e0d0";
      for (const q of S.dom) {
        const sy = q.t - oy;
        if (sy < -10 || sy > vh + 10) continue;
        const d = Math.hypot(Math.max(q.l - px, 0, px - q.r), q.t - py);
        const a = Math.max(0, 1 - d / 320) * 0.5;
        if (a < 0.02) continue;
        ctx.globalAlpha = a;
        ctx.fillRect(q.l - ox, sy - 1, q.r - q.l, 2);
      }
      ctx.globalAlpha = 1;
    }

    for (const q of S.ledges) {
      const sy = q.t - oy;
      if (sy > -10 && sy < vh + 10) line(ctx, q.l - ox, q.r - ox, sy, q.a * 0.85);
    }
    for (const q of S.spawn) line(ctx, q.l - ox, q.r - ox, q.t - oy, q.a, q.draw);

    // double-jump rings
    ctx.strokeStyle = "#40e0d0";
    ctx.lineWidth = 2;
    for (const r of S.rings) {
      ctx.globalAlpha = r.life / 18;
      ctx.beginPath();
      ctx.ellipse(r.x - ox, r.y - oy, r.r * 1.6, r.r * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // dust
    ctx.fillStyle = "rgba(190,255,248,.9)";
    for (const d of S.particles) {
      ctx.globalAlpha = Math.max(0, d.life / 30);
      ctx.fillRect(d.x - ox - 1.5, d.y - oy - 1.5, 3, 3);
    }
    ctx.globalAlpha = 1;

    if (!p.live) return;
    let frame = "idle";
    if (!p.ground) frame = "jump";
    else if (Math.abs(p.vx) > 0.6) frame = Math.floor(S.frame / 6) % 2 ? "run1" : "run2";
    const img = SPRITES[frame][p.face < 0 ? 1 : 0];
    // squash on landing, stretch on take-off, anchored at the feet
    const sx = 1 + p.squash * 0.22 - p.stretch * 0.12;
    const sy = 1 - p.squash * 0.2 + p.stretch * 0.14;
    const dw = W * sx, dh = H * sy;
    ctx.save();
    ctx.shadowColor = "rgba(64,224,208,.45)";
    ctx.shadowBlur = 10;
    ctx.drawImage(img, Math.round(p.x - ox + (W - dw) / 2), Math.round(p.y - oy + (H - dh)), Math.round(dw), Math.round(dh));
    ctx.restore();
  }

  function loop(ts) {
    if (!S) return;
    if (!S.last) S.last = ts;
    S.acc += Math.min(100, ts - S.last);
    S.last = ts;
    while (S && S.acc >= STEP_MS && !S.dead) { step(); S.acc -= STEP_MS; }
    if (!S) return;
    if (!S.dead) { camera(); pokePortrait(); }
    draw();
    S.raf = requestAnimationFrame(loop);
  }

  function die() {
    if (S.dead) return;
    S.dead = true;
    S.ui.over.hidden = false;
    S.ui.hint.classList.add("is-faded");
    setTimeout(stop, 850);
  }

  /* ---------- public API ---------- */
  // Desktop only: on phones and touch screens the page is too narrow to play on.
  const SUPPORTED = window.matchMedia("(min-width: 901px) and (hover: hover) and (pointer: fine)");

  function start() {
    if (S || !SUPPORTED.matches) return;
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
    S = {
      keys: { left: false, right: false, jump: false, down: false },
      player: { x: 0, y: 0, vx: 0, vy: 0, ground: null, sinceGround: 99, airJumps: 1, face: 1, squash: 0, stretch: 0, live: false },
      dom: [], ledges: [], spawn: [], particles: [], rings: [],
      frame: 0, acc: 0, last: 0, jumpBuffer: 0, dropFrames: 0, ignore: null, poking: false, dead: false,
      reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    docEl.classList.add("game-on");
    buildUI();
    readPage();
    buildLedges();
    buildSpawn();
    const first = S.spawn[0];
    S.player.x = first.l + (first.r - first.l) / 2 - W / 2;
    S.player.y = first.t - H - 260;
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("keyup", onKey, { capture: true });
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onResize);
    SUPPORTED.addEventListener("change", onSupportChange);
    S.raf = requestAnimationFrame(loop);
    document.dispatchEvent(new CustomEvent("sg-game", { detail: { active: true } }));
  }

  function onResize() { if (!S) return; sizeCanvas(); readPage(); buildLedges(); }
  function onSupportChange() { if (!SUPPORTED.matches) stop(); }

  function stop() {
    if (!S) return;
    cancelAnimationFrame(S.raf);
    clearTimeout(S.hintTimer);
    if (S.poking) document.getElementById("portrait-canvas")?.dispatchEvent(new CustomEvent("game-poke-end"));
    S.ui.wrap.remove();
    window.removeEventListener("keydown", onKey, { capture: true });
    window.removeEventListener("keyup", onKey, { capture: true });
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("resize", onResize);
    SUPPORTED.removeEventListener("change", onSupportChange);
    docEl.classList.remove("game-on");
    S = null;
    document.dispatchEvent(new CustomEvent("sg-game", { detail: { active: false } }));
  }

  window.SGGame = {
    start,
    stop,
    toggle() { if (S) stop(); else start(); },
    get active() { return !!S; },
    get supported() { return SUPPORTED.matches; },
  };
})();
