/* ============================================================
   AIGEN SOLUTIONS — FX : tempête neuronale (fond global)
   Particules dérivantes + liens de proximité + éclairs ramifiés.
   Sobre, performant, theme-aware, respecte reduced-motion.
   ============================================================ */
(function (global) {
  'use strict';

  function rgba(hex, a) {
    hex = (hex || '#7D8BD4').trim();
    if (hex[0] === '#') hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function accent() {
    var c = getComputedStyle(document.documentElement).getPropertyValue('--accent');
    return c && c.trim() ? c.trim() : '#7D8BD4';
  }

  var AIGENFX = {
    started: false,
    start: function () {
      if (this.started) return; this.started = true;
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var canvas = document.getElementById('fx-canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'fx-canvas';
        document.body.appendChild(canvas);
      }
      var ctx = canvas.getContext('2d');
      var DPR = Math.min(window.devicePixelRatio || 1, 2);
      var W = 0, H = 0, nodes = [], bolts = [], raf = null, running = true, t = 0;
      var col = accent();

      function resize() {
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = W * DPR; canvas.height = H * DPR;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        build();
      }
      function build() {
        var count = Math.round(Math.min(90, Math.max(34, (W * H) / 26000)));
        nodes = [];
        for (var i = 0; i < count; i++) {
          nodes.push({
            x: Math.random() * W, y: Math.random() * H,
            vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
            r: Math.random() * 1.6 + 0.7
          });
        }
      }

      /* lightning between two points: recursive midpoint displacement */
      function makeBolt(a, b) {
        var segs = [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
        for (var pass = 0; pass < 4; pass++) {
          var next = [segs[0]];
          for (var i = 0; i < segs.length - 1; i++) {
            var p = segs[i], q = segs[i + 1];
            var mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
            var dx = q.x - p.x, dy = q.y - p.y, len = Math.sqrt(dx * dx + dy * dy);
            var off = (Math.random() - 0.5) * len * 0.32;
            next.push({ x: mx - dy / len * off, y: my + dx / len * off });
            next.push(q);
          }
          segs = next;
        }
        return { pts: segs, life: 1, branches: [] };
      }
      function spawnBolt() {
        if (nodes.length < 2) return;
        var a = nodes[(Math.random() * nodes.length) | 0];
        var best = null, bd = 1e9;
        for (var k = 0; k < 6; k++) {
          var c = nodes[(Math.random() * nodes.length) | 0];
          var d = Math.hypot(c.x - a.x, c.y - a.y);
          if (d > 120 && d < bd) { bd = d; best = c; }
        }
        if (best) bolts.push(makeBolt(a, best));
      }

      function step() {
        if (!running) return;
        t++;
        ctx.clearRect(0, 0, W, H);

        // move + proximity links
        var maxD = Math.min(168, W * 0.13);
        for (var i = 0; i < nodes.length; i++) {
          var p = nodes[i];
          p.x += p.vx; p.y += p.vy;
          if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
          if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
          for (var j = i + 1; j < nodes.length; j++) {
            var q = nodes[j], dx = p.x - q.x, dy = p.y - q.y, dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < maxD) {
              var o = (1 - dist / maxD) * 0.16;
              ctx.strokeStyle = rgba(col, o);
              ctx.lineWidth = 0.6;
              ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
            }
          }
        }
        // nodes
        for (var n = 0; n < nodes.length; n++) {
          var nn = nodes[n];
          ctx.beginPath(); ctx.arc(nn.x, nn.y, nn.r, 0, Math.PI * 2);
          ctx.fillStyle = rgba(col, 0.55); ctx.fill();
        }

        // occasionally spawn lightning
        if (!reduce && Math.random() < 0.018 && bolts.length < 3) spawnBolt();

        // draw bolts
        for (var bi = bolts.length - 1; bi >= 0; bi--) {
          var bolt = bolts[bi];
          bolt.life -= 0.045;
          if (bolt.life <= 0) { bolts.splice(bi, 1); continue; }
          var glow = bolt.life;
          ctx.save();
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          // outer glow
          ctx.strokeStyle = rgba(col, 0.10 * glow);
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(bolt.pts[0].x, bolt.pts[0].y);
          for (var s = 1; s < bolt.pts.length; s++) ctx.lineTo(bolt.pts[s].x, bolt.pts[s].y);
          ctx.stroke();
          // core
          ctx.strokeStyle = rgba('#CBD3FF', 0.85 * glow);
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(bolt.pts[0].x, bolt.pts[0].y);
          for (var s2 = 1; s2 < bolt.pts.length; s2++) ctx.lineTo(bolt.pts[s2].x, bolt.pts[s2].y);
          ctx.stroke();
          // endpoints flash
          ctx.fillStyle = rgba('#CBD3FF', 0.9 * glow);
          ctx.beginPath(); ctx.arc(bolt.pts[0].x, bolt.pts[0].y, 2.6 * glow + 1, 0, Math.PI * 2); ctx.fill();
          var last = bolt.pts[bolt.pts.length - 1];
          ctx.beginPath(); ctx.arc(last.x, last.y, 2.6 * glow + 1, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

        raf = requestAnimationFrame(step);
      }

      function startLoop() { if (raf) cancelAnimationFrame(raf); running = true; step(); }

      resize();
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', function () {
        running = !document.hidden;
        if (running) startLoop(); else if (raf) cancelAnimationFrame(raf);
      });
      // refresh color on theme change
      var mo = new MutationObserver(function () { col = accent(); });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

      if (reduce) { step(); if (raf) cancelAnimationFrame(raf); } // single static frame
      else startLoop();
    }
  };

  global.AIGENFX = AIGENFX;
})(window);
