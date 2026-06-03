/* ============================================================
   AIGEN SOLUTIONS — Hero core : sphère neuronale orbitale
   Réseau de nœuds projeté en 3D, rotation lente, arcs lumineux.
   ============================================================ */
(function (global) {
  'use strict';

  function accent() {
    var c = getComputedStyle(document.documentElement).getPropertyValue('--accent-bright');
    return (c && c.trim()) || '#A5B0EC';
  }
  function rgba(hex, a) {
    hex = (hex || '#A5B0EC').trim(); if (hex[0] === '#') hex = hex.slice(1);
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  var HeroCore = {
    started: false,
    start: function () {
      if (this.started) return;
      var canvas = document.getElementById('hero-core');
      if (!canvas) return;
      this.started = true;
      var ctx = canvas.getContext('2d');
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var DPR = Math.min(window.devicePixelRatio || 1, 2);
      var W = 0, H = 0, R = 0, pts = [], raf = null, ang = 0, running = true;
      var col = accent();

      function resize() {
        var r = canvas.getBoundingClientRect();
        W = r.width; H = r.height; R = Math.min(W, H) * 0.40;
        canvas.width = W * DPR; canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      }
      function build() {
        pts = []; var N = 80;
        for (var i = 0; i < N; i++) {
          // fibonacci sphere
          var y = 1 - (i / (N - 1)) * 2;
          var rad = Math.sqrt(1 - y * y);
          var theta = i * 2.399963;
          pts.push({ x: Math.cos(theta) * rad, y: y, z: Math.sin(theta) * rad, p: Math.random() * Math.PI * 2 });
        }
      }
      function step() {
        if (!running) return;
        ang += 0.0024;
        ctx.clearRect(0, 0, W, H);
        var cx = W / 2, cy = H / 2;
        var cosA = Math.cos(ang), sinA = Math.sin(ang);
        var proj = [];
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          var x = p.x * cosA - p.z * sinA;
          var z = p.x * sinA + p.z * cosA;
          var y = p.y;
          var pulse = reduce ? 1 : (0.9 + 0.1 * Math.sin(ang * 12 + p.p));
          var scale = (z + 1.6) / 2.6;
          proj.push({ sx: cx + x * R * pulse, sy: cy + y * R * pulse, depth: scale, z: z });
        }
        // links
        for (var a = 0; a < proj.length; a++) {
          for (var b = a + 1; b < proj.length; b++) {
            var dx = proj[a].sx - proj[b].sx, dy = proj[a].sy - proj[b].sy;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < R * 0.52) {
              var o = (1 - d / (R * 0.52)) * 0.22 * ((proj[a].depth + proj[b].depth) / 2);
              ctx.strokeStyle = rgba(col, o);
              ctx.lineWidth = 0.6;
              ctx.beginPath(); ctx.moveTo(proj[a].sx, proj[a].sy); ctx.lineTo(proj[b].sx, proj[b].sy); ctx.stroke();
            }
          }
        }
        // nodes (sorted by depth)
        proj.sort(function (m, n) { return m.z - n.z; });
        for (var k = 0; k < proj.length; k++) {
          var pr = proj[k];
          var rr = 0.7 + pr.depth * 2;
          ctx.beginPath(); ctx.arc(pr.sx, pr.sy, rr, 0, Math.PI * 2);
          ctx.fillStyle = rgba(col, 0.3 + pr.depth * 0.6); ctx.fill();
        }
        raf = requestAnimationFrame(step);
      }
      function loop() { if (raf) cancelAnimationFrame(raf); running = true; step(); }

      resize(); build();
      window.addEventListener('resize', function () { resize(); });
      document.addEventListener('visibilitychange', function () {
        running = !document.hidden; if (running) loop(); else if (raf) cancelAnimationFrame(raf);
      });
      new MutationObserver(function () { col = accent(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      if (reduce) { step(); if (raf) cancelAnimationFrame(raf); } else loop();
    }
  };

  global.AIGENHeroCore = HeroCore;
})(window);
