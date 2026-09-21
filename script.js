(() => {
  const canvas = document.getElementById('universe');
  const ctx = canvas.getContext('2d');
  const glowCursor = document.getElementById('glowCursor');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PALETTE = [
    { light: 'rgba(200,240,245,0.9)', mid: 'rgba(159,232,240,0.55)', edge: 'rgba(159,232,240,0)' }, // cyan
    { light: 'rgba(250,220,245,0.9)', mid: 'rgba(243,184,230,0.55)', edge: 'rgba(243,184,230,0)' }, // pink
    { light: 'rgba(230,220,250,0.9)', mid: 'rgba(198,179,242,0.55)', edge: 'rgba(198,179,242,0)' }, // lavender
  ];

  let width, height, dpr;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Jellyfish ----------
  class Jellyfish {
    constructor() { this.reset(true); }

    reset(initial = false) {
      this.size = 18 + Math.random() * 30;
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : height + this.size * 2;
      this.speed = 0.18 + Math.random() * 0.28;
      this.phase = Math.random() * Math.PI * 2;
      this.driftAmp = 0.25 + Math.random() * 0.5;
      this.tentacles = 5 + Math.floor(Math.random() * 3);
      this.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    }

    update(dt, t) {
      this.y -= this.speed * dt * 0.06;
      this.x += Math.sin(t * 0.0004 + this.phase) * this.driftAmp;
      if (this.y < -this.size * 3) this.reset(false);
      if (this.x < -60) this.x = width + 60;
      if (this.x > width + 60) this.x = -60;
    }

    draw(t) {
      const bob = Math.sin(t * 0.0012 + this.phase) * 5;
      const pulse = 1 + Math.sin(t * 0.0022 + this.phase) * 0.07;
      const r = this.size;

      ctx.save();
      ctx.translate(this.x, this.y + bob);
      ctx.scale(pulse, 1);

      ctx.shadowColor = this.color.mid;
      ctx.shadowBlur = 28;

      const grad = ctx.createRadialGradient(0, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
      grad.addColorStop(0, this.color.light);
      grad.addColorStop(0.6, this.color.mid);
      grad.addColorStop(1, this.color.edge);

      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.bezierCurveTo(-r, -r * 1.25, r, -r * 1.25, r, 0);
      const scallops = 7;
      for (let i = 0; i <= scallops; i++) {
        const sx = r - (2 * r * i) / scallops;
        const sy = Math.sin(i * 1.3 + t * 0.003 + this.phase) * 3.5;
        ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.shadowBlur = 10;
      ctx.lineCap = 'round';
      for (let i = 0; i < this.tentacles; i++) {
        const tx = -r * 0.65 + (1.3 * r * i) / (this.tentacles - 1);
        ctx.beginPath();
        ctx.moveTo(tx, 2);
        const segs = 5;
        for (let s = 1; s <= segs; s++) {
          const yy = (s * r * 1.6) / segs;
          const xx = tx + Math.sin(t * 0.0035 + this.phase + s * 0.8 + i) * (3 + s * 1.1);
          ctx.lineTo(xx, yy);
        }
        ctx.strokeStyle = this.color.mid;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ---------- Stars scattered at the seabed ----------
  class Star {
    constructor() { this.reset(); }

    reset() {
      // concentrate stars in the lower portion of the screen (the "seabed")
      const band = Math.random();
      this.x = Math.random() * width;
      this.y = height * (0.55 + Math.pow(band, 0.7) * 0.45);
      this.size = 0.6 + Math.random() * 1.8;
      this.phase = Math.random() * Math.PI * 2;
      this.speed = 0.0012 + Math.random() * 0.0018;
    }

    draw(t) {
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t * this.speed + this.phase));
      ctx.save();
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = '#fef6ff';
      ctx.shadowColor = '#fef6ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------- Ripples from the cursor ----------
  class Ripple {
    constructor(x, y, strong = false) {
      this.x = x;
      this.y = y;
      this.radius = 0;
      this.alpha = strong ? 0.5 : 0.32;
      this.growth = strong ? 2.6 : 1.6;
      this.maxRadius = strong ? 160 : 90;
      this.fade = strong ? 0.006 : 0.012;
    }

    update() {
      this.radius += this.growth;
      this.alpha -= this.fade;
    }

    get dead() { return this.alpha <= 0 || this.radius > this.maxRadius; }

    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(this.alpha, 0);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.shadowColor = '#e6d9ff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  let jellyfish = [];
  let stars = [];
  let ripples = [];

  function populate() {
    const jellyCount = Math.max(6, Math.round((width * height) / 90000));
    const starCount = Math.max(60, Math.round((width * height) / 6000));
    jellyfish = Array.from({ length: jellyCount }, () => new Jellyfish());
    stars = Array.from({ length: starCount }, () => new Star());
  }

  let lastRippleTime = 0;
  function addRipple(x, y, strong = false) {
    const now = performance.now();
    if (!strong && now - lastRippleTime < 45) return;
    lastRippleTime = now;
    ripples.push(new Ripple(x, y, strong));
    if (ripples.length > 60) ripples.shift();
  }

  function handlePointer(x, y) {
    glowCursor.style.transform = `translate(${x}px, ${y}px)`;
    addRipple(x, y);
  }

  window.addEventListener('mousemove', (e) => handlePointer(e.clientX, e.clientY));
  window.addEventListener('click', (e) => addRipple(e.clientX, e.clientY, true));
  window.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (t) handlePointer(t.clientX, t.clientY);
    },
    { passive: true }
  );
  window.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (t) addRipple(t.clientX, t.clientY, true);
    },
    { passive: true }
  );

  window.addEventListener('resize', () => {
    resize();
    populate();
  });

  let lastTime = performance.now();
  function tick(now) {
    const dt = Math.min(now - lastTime, 48);
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    for (const s of stars) s.draw(now);

    for (const j of jellyfish) {
      j.update(dt, now);
      j.draw(now);
    }

    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].update();
      ripples[i].draw();
      if (ripples[i].dead) ripples.splice(i, 1);
    }

    requestAnimationFrame(tick);
  }

  resize();
  populate();

  if (reduceMotion) {
    // Still render one calm frame instead of a fully static empty canvas.
    for (const s of stars) s.draw(0);
    for (const j of jellyfish) j.draw(0);
  } else {
    requestAnimationFrame(tick);
  }
})();
