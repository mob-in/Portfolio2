/**
 * Particle Text - Vanilla JS Canvas implementation
 * Inspired by ReactBits.dev particle-text component
 */
(function () {
  const hexToRgb = (hex) => {
    const clean = hex.replace('#', '').trim();
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  };

  const mixRgb = (from, to, amount) => ({
    r: Math.round(from.r + (to.r - from.r) * amount),
    g: Math.round(from.g + (to.g - from.g) * amount),
    b: Math.round(from.b + (to.b - from.b) * amount),
  });

  const rgbToCss = (rgb) => `rgb(${rgb.r},${rgb.g},${rgb.b})`;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  function initParticleText(container, opts = {}) {
    const options = Object.assign(
      {
        text: 'Mobin Thomas',
        particleSize: 2.5,
        density: 4,
        color: '#0f172a',
        highlightColor: '#3b82f6',
        scatter: 200,
        gatherDuration: 1800,
        stagger: 460,
        pointerRepel: 45,
        repelRadius: 130,
        idleDrift: 0.6,
        glow: true,
        fontSize: null, // will be computed from container
      },
      opts
    );

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'default';
    container.style.position = 'relative';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    let particles = [];
    let rafId = null;
    let gathering = false;
    let gatherStart = 0;
    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;

    const pointer = { active: false, x: 0, y: 0, smoothX: 0, smoothY: 0 };

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
    }

    function getFontSize() {
      if (options.fontSize) return options.fontSize;
      // Start from a responsive size and shrink until the text fits
      let size = Math.min(width * 0.12, 96);
      const minSize = 20;
      const padding = 16; // px breathing room on each side
      const maxTextWidth = width - padding * 2;

      // Use an offscreen context to measure
      const probe = document.createElement('canvas');
      const pCtx = probe.getContext('2d');
      while (size > minSize) {
        pCtx.font = `800 ${size}px Inter, sans-serif`;
        const measured = pCtx.measureText(options.text).width;
        if (measured <= maxTextWidth) break;
        size -= 1;
      }
      return size;
    }

    function buildParticles() {
      const fs = getFontSize();
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.round(width * dpr);
      offscreen.height = Math.round(height * dpr);
      const offCtx = offscreen.getContext('2d');
      offCtx.scale(dpr, dpr);

      offCtx.clearRect(0, 0, width, height);
      offCtx.fillStyle = '#000000';
      offCtx.font = `800 ${fs}px Inter, sans-serif`;
      offCtx.textAlign = 'center';
      offCtx.textBaseline = 'middle';
      offCtx.fillText(options.text, width / 2, height / 2);

      const imageData = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const data = imageData.data;

      const colorRgb = hexToRgb(options.color) || { r: 15, g: 23, b: 42 };
      const highlightRgb = hexToRgb(options.highlightColor) || { r: 59, g: 130, b: 246 };
      const step = options.density;
      const newParticles = [];

      for (let y = 0; y < offscreen.height; y += step) {
        for (let x = 0; x < offscreen.width; x += step) {
          const idx = (y * offscreen.width + x) * 4;
          if (data[idx + 3] > 128) {
            const seed = Math.random();
            const depth = Math.random();
            const highlight = Math.random() < 0.15;
            const mixed = mixRgb(colorRgb, highlightRgb, highlight ? 1 : depth * 0.25);
            const tx = x / dpr;
            const ty = y / dpr;
            const angle = seed * Math.PI * 2;
            const dist = options.scatter * (0.35 + depth * 0.75);
            newParticles.push({
              targetX: tx,
              targetY: ty,
              x: tx + Math.cos(angle) * dist + (depth - 0.5) * options.scatter * 0.55,
              y: ty + Math.sin(angle) * dist + (seed - 0.5) * options.scatter * 0.55,
              startX: 0,
              startY: 0,
              size: options.particleSize * (0.6 + depth * 0.7),
              color: rgbToCss(mixed),
              seed,
              depth,
              vx: 0,
              vy: 0,
            });
          }
        }
      }

      particles = newParticles;
      startGather(true);
    }

    function startGather(fromScatter = true) {
      if (!particles.length) return;
      const now = performance.now();
      particles.forEach((p) => {
        if (fromScatter) {
          const angle = p.seed * Math.PI * 2;
          const dist = options.scatter * (0.35 + p.depth * 0.75);
          p.x = p.targetX + Math.cos(angle) * dist + (p.depth - 0.5) * options.scatter * 0.55;
          p.y = p.targetY + Math.sin(angle) * dist + (p.seed - 0.5) * options.scatter * 0.55;
        }
        p.startX = p.x;
        p.startY = p.y;
        p.delay = p.seed * options.stagger;
      });
      gatherStart = now;
      gathering = true;
    }

    function render(now) {
      ctx.clearRect(0, 0, width, height);

      // Smooth pointer
      pointer.smoothX += (pointer.x - pointer.smoothX) * 0.12;
      pointer.smoothY += (pointer.y - pointer.smoothY) * 0.12;

      const elapsed = now - gatherStart;

      particles.forEach((p) => {
        if (gathering) {
          const t = Math.max(0, elapsed - p.delay) / options.gatherDuration;
          if (t < 1) {
            const e = easeOutCubic(Math.min(t, 1));
            p.x = p.startX + (p.targetX - p.startX) * e;
            p.y = p.startY + (p.targetY - p.startY) * e;
          } else {
            p.x = p.targetX;
            p.y = p.targetY;
          }
        }

        // Idle drift
        p.x += (Math.random() - 0.5) * options.idleDrift * 0.4;
        p.y += (Math.random() - 0.5) * options.idleDrift * 0.4;

        // Pointer repel
        if (pointer.active) {
          const dx = p.x - pointer.smoothX;
          const dy = p.y - pointer.smoothY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < options.repelRadius && dist > 0) {
            const force = (1 - dist / options.repelRadius) * options.pointerRepel;
            p.vx += (dx / dist) * force * 0.08;
            p.vy += (dy / dist) * force * 0.08;
          }
        }

        p.vx *= 0.88;
        p.vy *= 0.88;
        p.x += p.vx;
        p.y += p.vy;

        // Draw
        if (options.glow) {
          ctx.shadowBlur = options.particleSize * 3;
          ctx.shadowColor = p.color;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = p.color;
        const s = p.size;
        if (s <= 2.1) {
          ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, s / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.shadowBlur = 0;
      rafId = requestAnimationFrame(render);
    }

    // Pointer events
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      pointer.active = true;
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    });
    canvas.addEventListener('mouseleave', () => {
      pointer.active = false;
    });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      pointer.active = true;
      pointer.x = e.touches[0].clientX - rect.left;
      pointer.y = e.touches[0].clientY - rect.top;
    }, { passive: false });
    canvas.addEventListener('touchend', () => {
      pointer.active = false;
    });

    // Click to re-scatter
    canvas.addEventListener('click', () => {
      startGather(true);
    });

    // Resize handler
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });

    // Kick off
    resize();
    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }

  window.initParticleText = initParticleText;
})();
