/* Liquid Margin — vanilla helpers for Budget Margin (no build step, no deps).
   Pairs with liquid-margin.css. Load after app.js:  <script src="./liquid-margin.js" defer></script>
   Everything is exposed on window.LM. */
(function (w) {
  'use strict';
  var SVG = 'http://www.w3.org/2000/svg';
  // one period of the sine surface, repeated twice across 200% width so translateX(-50%) loops seamlessly
  var WAVE_D   = 'M0 14C20 4 40 4 60 14S100 24 120 14 160 4 180 14s40 10 60 0V24H0Z';
  var WAVE_Y_D = 'M14 0C4 20 4 40 14 60S24 100 14 120 4 160 14 180s10 40 0 60H0V0Z';

  function svgWave(fill, vertical) {
    var s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', vertical ? '0 0 24 240' : '0 0 240 24');
    s.setAttribute('preserveAspectRatio', 'none');
    s.setAttribute('class', vertical ? 'lm-wave-y' : 'lm-wave');
    var p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', vertical ? WAVE_Y_D : WAVE_D);
    p.setAttribute('fill', fill);
    s.appendChild(p);
    return s;
  }

  /* Build a vessel/tank fill once. el = .lm-vessel | .lm-tank | .lm-goal-vessel
     opts: {vertical:false, colors:['rgba(...)','rgba(...)']} — 2 colors = two wave layers */
  function mountFill(el, opts) {
    opts = opts || {};
    var fill = el.querySelector('.lm-fill, .lm-tank-fill');
    if (!fill) {
      fill = document.createElement('div');
      fill.className = opts.vertical ? 'lm-tank-fill' : 'lm-fill';
      el.insertBefore(fill, el.firstChild);
    }
    var cols = opts.colors || ['color-mix(in srgb,var(--accent) 38%,transparent)'];
    cols.forEach(function (c, i) {
      var wv = svgWave(c, !!opts.vertical);
      if (!opts.vertical) wv.classList.add(i === 0 ? 'lm-wave--front' : 'lm-wave--back');
      fill.appendChild(wv);
    });
    return fill;
  }

  /* pct 0..1 — vertical:true fills left→right (tank), else bottom→top (vessel) */
  function setFill(el, pct, vertical) {
    var fill = el.querySelector('.lm-fill, .lm-tank-fill');
    if (!fill) return;
    var v = Math.max(0, Math.min(1, pct)) * 100;
    if (vertical) fill.style.width = Math.max(2, v).toFixed(1) + '%';
    else fill.style.height = Math.max(4, v).toFixed(1) + '%';
  }

  /* eased count-up on a text node; returns a cancel fn */
  function countUp(el, from, to, dur, fmt) {
    dur = dur || 850; fmt = fmt || function (n) { return Math.round(n).toLocaleString('en-US'); };
    var raf, t0 = performance.now();
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
    })(t0);
    return function () { cancelAnimationFrame(raf); };
  }

  /* donut: segs = [{name, value, color}] → renders into an <svg class="lm-donut" viewBox="0 0 160 160">
     onPick(name|null) fires on slice tap. r/width match the mock: r56, stroke 24 (30 when focused). */
  function donut(svg, segs, onPick, focused) {
    var R = 56, C = 2 * Math.PI * R, total = segs.reduce(function (a, s) { return a + s.value; }, 0), acc = 0;
    svg.innerHTML = '';
    segs.forEach(function (s) {
      var frac = total ? s.value / total : 0;
      var c = document.createElementNS(SVG, 'circle');
      c.setAttribute('cx', 80); c.setAttribute('cy', 80); c.setAttribute('r', R);
      c.setAttribute('fill', 'none'); c.setAttribute('stroke', s.color);
      c.setAttribute('stroke-width', focused === s.name ? 30 : 24);
      c.setAttribute('stroke-dasharray', (C * frac - 2).toFixed(1) + ' ' + C.toFixed(1));
      c.setAttribute('stroke-dashoffset', (-C * acc).toFixed(1));
      c.setAttribute('transform', 'rotate(-90 80 80)');
      c.setAttribute('class', 'lm-slice');
      if (focused && focused !== s.name) c.dataset.muted = 'true';
      c.addEventListener('click', function () { onPick(focused === s.name ? null : s.name); });
      svg.appendChild(c);
      acc += frac;
    });
    var hole = document.createElementNS(SVG, 'circle');
    hole.setAttribute('cx', 80); hole.setAttribute('cy', 80); hole.setAttribute('r', 40);
    hole.setAttribute('fill', '#0A1C23');
    svg.appendChild(hole);
    return { R: R, C: C, total: total };
  }

  /* line chart geometry for viewBox 0 0 300 168 (matches the mock) */
  function lineGeom(values, n, box) {
    box = box || { x0: 12, w: 276, yTop: 18, yBase: 146 };
    var top = Math.max.apply(null, values) * 1.12;
    var X = function (i) { return box.x0 + i * (box.w / (n - 1)); };
    var Y = function (v) { return box.yBase - (v / top) * (box.yBase - box.yTop); };
    return {
      X: X, Y: Y, top: top,
      path: function (arr) {
        return arr.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
      },
      area: function (arr) {
        return this.path(arr) + ' L ' + X(n - 1).toFixed(1) + ' ' + box.yBase + ' L ' + box.x0 + ' ' + box.yBase + ' Z';
      },
      hit: function (i) { return { x: (X(i) - (box.w / (n - 1)) / 2).toFixed(1), w: (box.w / (n - 1)).toFixed(1) }; }
    };
  }

  /* press-and-hold logger: ramps +2 every 55ms, caps at max, commits on release */
  function holdToLog(btn, opts) {
    var max = (opts && opts.max) || 120, step = (opts && opts.step) || 2, iv, amt = 0, on = false;
    function paint() {
      btn.style.background = 'conic-gradient(var(--violet) ' + (amt / max * 100).toFixed(1) + '%,rgba(123,171,183,.14) 0)';
      opts.onChange && opts.onChange(amt, on);
    }
    btn.addEventListener('pointerdown', function (e) {
      btn.setPointerCapture && btn.setPointerCapture(e.pointerId);
      on = true; amt = 0; paint();
      iv = setInterval(function () { amt = Math.min(max, amt + step); paint(); }, 55);
      btn.dataset.holding = 'true';
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      btn.addEventListener(ev, function () {
        if (!on) return;
        clearInterval(iv); on = false; btn.dataset.holding = 'false';
        if (amt > 0 && opts.onCommit) opts.onCommit(Math.round(amt));
        amt = 0; setTimeout(paint, 400);
      });
    });
    paint();
  }

  /* drag a knob around the app's existing 270° arc (r82, cx125, cy110, rotate 135) → 0..1 */
  function arcDrag(svg, onChange) {
    var dragging = false;
    function pct(e) {
      var r = svg.getBoundingClientRect();
      var cx = r.left + r.width * 0.5, cy = r.top + r.height * (110 / 210);
      var a = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 360) % 360;
      var t = (a - 135 + 360) % 360;
      if (t > 270) t = t < 315 ? 270 : 0;
      return t / 270;
    }
    svg.addEventListener('pointerdown', function (e) {
      dragging = true; svg.setPointerCapture && svg.setPointerCapture(e.pointerId); onChange(pct(e));
    });
    svg.addEventListener('pointermove', function (e) { if (dragging) onChange(pct(e)); });
    ['pointerup', 'pointercancel'].forEach(function (ev) { svg.addEventListener(ev, function () { dragging = false; }); });
    return {
      // arc dash + knob position for a given pct — same numbers the current gauge uses
      dash: function (p) { return (386.4 * p).toFixed(1) + ' 515.2'; },
      knob: function (p) {
        var rad = (135 + 270 * p) * Math.PI / 180;
        return { x: (125 + 82 * Math.cos(rad)).toFixed(1), y: (110 + 82 * Math.sin(rad)).toFixed(1) };
      }
    };
  }

  w.LM = { svgWave: svgWave, mountFill: mountFill, setFill: setFill, countUp: countUp,
           donut: donut, lineGeom: lineGeom, holdToLog: holdToLog, arcDrag: arcDrag };
})(window);
