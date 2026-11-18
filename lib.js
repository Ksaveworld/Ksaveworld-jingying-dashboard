// 图表组件库：所有图表都在 dash.draw 的绘制函数里调用，按容器实际宽度绘制
(function () {
  const C = {};
  window.C = C;
  C.col = { teal: '#14957a', mint: '#4fcfa8', amber: '#f5b83d', sky: '#4b8bf0', coral: '#f06b47', violet: '#8b78e6', grey: '#c9d8d2', ink: '#14302a', pale: '#bfe9db' };
  const nf = d3.format(',.0f');
  const bad = (v) => v == null || isNaN(v);
  C.f = {
    raw: (v) => (v == null ? '—' : String(v)),
    int: (v) => (bad(v) ? '—' : nf(v)),
    d1: (v) => (bad(v) ? '—' : d3.format(',.1f')(v)),
    pct: (v) => (bad(v) ? '—' : d3.format('.1%')(v)),
    pct0: (v) => (bad(v) ? '—' : d3.format('.0%')(v)),
    dpct: (v) => (bad(v) ? '—' : (v > 0 ? '+' : '') + d3.format('.1%')(v)),
    dpp: (v) => (bad(v) ? '—' : (v > 0 ? '+' : '') + d3.format('.1f')(v * 100) + 'pp'),
    yuan: (v) => (bad(v) ? '—' : '¥' + nf(v)),
    wan: (v) => { if (bad(v)) return '—'; const w = v / 1e4; return (Math.abs(w) >= 100 ? nf(w) : d3.format(',.1f')(w)) + '万'; },
    wanAxis: (v) => (v === 0 ? '0' : d3.format(',~f')(+(v / 1e4).toFixed(1)) + '万'),
  };
  C.fmt = (k, v) => (C.f[k] || C.f.int)(v);
  C.month = (m) => +String(m).slice(5, 7) + '月';
  C.day = (s) => +String(s).slice(5, 7) + '/' + +String(s).slice(8, 10);
  C.date = (s) => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
  let uid = 0;

  C.need = function (el, ids) {
    const out = [];
    for (const id of ids) {
      const s = dash.data(id);
      if (s.status !== 'ok' || s.data == null) {
        const ph = document.createElement('div');
        ph.className = 'bz-ph';
        ph.textContent = s.status === 'error' ? '加载失败' : '—';
        el.replaceChildren(ph);
        return null;
      }
      out.push(s.data);
    }
    return out;
  };

  C.base = function (el, h, aria) {
    el.replaceChildren();
    const w = Math.max(240, Math.floor(el.clientWidth || 600));
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('height', h)
      .attr('role', 'img').attr('aria-label', aria || el.getAttribute('aria-label') || '图表');
    svg.append('defs');
    const tip = document.createElement('div');
    tip.className = 'bz-tip';
    tip.hidden = true;
    el.appendChild(tip);
    return { svg, w, h, tip };
  };

  // 渐变：vertical 时从上到下，a/b 为两端不透明度
  C.grad = function (svg, color, a, b, horizontal, color2) {
    const id = 'bzg' + ++uid;
    const g = svg.select('defs').append('linearGradient').attr('id', id)
      .attr('x1', 0).attr('y1', 0).attr('x2', horizontal ? 1 : 0).attr('y2', horizontal ? 0 : 1);
    g.append('stop').attr('offset', '0%').style('stop-color', color).attr('stop-opacity', a);
    g.append('stop').attr('offset', '100%').style('stop-color', color2 || color).attr('stop-opacity', b);
    return `url(#${id})`;
  };
  C.shadow = function (svg, color) {
    const id = 'bzs' + ++uid;
    const f = svg.select('defs').append('filter').attr('id', id).attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '160%');
    f.append('feDropShadow').attr('dx', 0).attr('dy', 3).attr('stdDeviation', 3).style('flood-color', color).attr('flood-opacity', 0.28);
    return `url(#${id})`;
  };

  C.textW = function (svg, strs, cls) {
    const g = svg.append('g').attr('class', cls || 'bz-tick');
    let mx = 0;
    strs.forEach((s) => { const t = g.append('text').text(s); mx = Math.max(mx, t.node().getComputedTextLength() || String(s).length * 7); });
    g.remove();
    return Math.ceil(mx);
  };

  C.rtop = (x, y, w, h, r) => {
    if (h <= 0.5) return '';
    r = Math.max(0, Math.min(r, w / 2, h));
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };

  C.gridY = function (svg, y, x0, x1, fmt, right) {
    const g = svg.append('g');
    y.ticks(5).forEach((t) => {
      if (!right) g.append('line').attr('class', 'bz-gl').attr('x1', x0).attr('x2', x1).attr('y1', y(t)).attr('y2', y(t));
      g.append('text').attr('class', 'bz-tick').attr('x', right ? x1 + 8 : x0 - 8).attr('y', y(t)).attr('dy', '0.32em')
        .attr('text-anchor', right ? 'start' : 'end').text(fmt(t));
    });
  };
  C.axisX = function (svg, labels, pos, yPix) {
    const g = svg.append('g');
    const step = labels.length > 1 ? Math.abs(pos[1] - pos[0]) : 999;
    const need = d3.max(labels.map((l) => C.textW(svg, [l]))) + 10;
    const every = Math.max(1, Math.ceil(need / step));
    labels.forEach((l, i) => {
      if (i % every) return;
      g.append('text').attr('class', 'bz-tick').attr('x', pos[i]).attr('y', yPix + 18).attr('text-anchor', 'middle').text(l);
    });
  };

  C.tipShow = function (tip, el, w, cx, top, title, rows) {
    tip.replaceChildren();
    const t = document.createElement('div'); t.className = 'bz-tip-t'; t.textContent = title; tip.appendChild(t);
    rows.forEach(([n, c, v]) => {
      const r = document.createElement('div'); r.className = 'bz-tip-r';
      const sw = document.createElement('i'); sw.style.background = c;
      const nm = document.createElement('span'); nm.textContent = n;
      const b = document.createElement('b'); b.textContent = v;
      r.append(sw, nm, b); tip.appendChild(r);
    });
    tip.hidden = false;
    const sc = el.clientWidth / w, px = cx * sc, tw = tip.offsetWidth;
    let left = px + 14;
    if (left + tw > el.clientWidth) left = px - tw - 14;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = top + 'px';
  };

  // 组合图：柱（分组/堆叠，圆角顶部+渐变）与曲线（可带渐变面积），左右双轴
  C.combo = function (el, o) {
    const data = o.data, h = o.h || 250;
    const { svg, w, tip } = C.base(el, h, o.aria);
    const S = o.series;
    const isBar = (s) => (s.type || 'bar') === 'bar';
    const bars = S.filter(isBar), lines = S.filter((s) => !isBar(s));
    const v = (d, k) => (d[k] == null || d[k] === '' ? null : +d[k]);
    const xs = data.map(o.x);
    const ext = (arr, stack) => {
      let lo = 0, hi = 0;
      data.forEach((d) => {
        if (stack) hi = Math.max(hi, d3.sum(arr.filter(isBar), (s) => v(d, s.key) || 0));
        arr.forEach((s) => { const q = v(d, s.key); if (q != null) { hi = Math.max(hi, q); lo = Math.min(lo, q); } });
      });
      return [lo, hi];
    };
    const L = S.filter((s) => !s.right), R = S.filter((s) => s.right);
    let [lo, hi] = ext(L, o.stack);
    if (o.ref) hi = Math.max(hi, o.ref.value);
    if (o.min != null) lo = o.min;
    const y = d3.scaleLinear().domain([lo, hi || 1]).nice(5);
    const y2 = R.length ? d3.scaleLinear().domain([Math.min(0, ext(R)[0]), ext(R)[1] || 1]).nice(5) : null;
    const yf = o.yFmt || C.f.int, y2f = o.y2Fmt || C.f.int;
    const m = { t: 16, b: 28, l: C.textW(svg, y.ticks(5).map(yf)) + 12, r: y2 ? C.textW(svg, y2.ticks(5).map(y2f)) + 14 : 8 };
    y.range([h - m.b, m.t]);
    if (y2) y2.range([h - m.b, m.t]);
    const x = d3.scaleBand().domain(xs).range([m.l, w - m.r]).paddingInner(o.pad == null ? 0.42 : o.pad).paddingOuter(0.2);
    const cxOf = (i) => x(xs[i]) + x.bandwidth() / 2;
    C.gridY(svg, y, m.l, w - m.r, yf);
    if (y2) C.gridY(svg, y2, m.l, w - m.r, y2f, true);
    C.axisX(svg, xs.map(o.xFmt || ((s) => s)), xs.map((k, i) => cxOf(i)), h - m.b);
    const hl = svg.append('rect').attr('class', 'bz-hl').attr('y', m.t).attr('height', h - m.b - m.t).attr('rx', 6).attr('opacity', 0);
    const fills = {};
    bars.forEach((s) => { fills[s.key] = C.grad(svg, s.color, 1, 0.62); });
    const gb = svg.append('g');
    if (bars.length && o.stack) {
      const bw = x.bandwidth();
      data.forEach((d, i) => {
        let acc = 0;
        const last = bars.map((s) => v(d, s.key) || 0).reduce((li, q, j) => (q > 0 ? j : li), -1);
        bars.forEach((s, j) => {
          const q = v(d, s.key) || 0;
          const y0 = y(acc), y1 = y(acc + q);
          gb.append('path').attr('d', C.rtop(x(xs[i]), y1, bw, y0 - y1, j === last ? Math.min(6, bw / 3) : 0)).style('fill', fills[s.key]);
          acc += q;
        });
      });
    } else if (bars.length) {
      const x1 = d3.scaleBand().domain(bars.map((s) => s.key)).range([0, x.bandwidth()]).padding(bars.length > 1 ? 0.18 : 0);
      data.forEach((d, i) => bars.forEach((s) => {
        const q = v(d, s.key) || 0, yy = s.right ? y2 : y;
        gb.append('path').attr('d', C.rtop(x(xs[i]) + x1(s.key), yy(q), x1.bandwidth(), yy(0) - yy(q), Math.min(6, x1.bandwidth() / 3)))
          .style('fill', o.colorBy ? o.colorBy(d, s) : fills[s.key]);
      }));
    }
    if (o.ref) {
      svg.append('line').attr('class', 'bz-ref').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(o.ref.value)).attr('y2', y(o.ref.value));
      svg.append('text').attr('class', 'bz-ref-t').attr('x', m.l + 4).attr('y', y(o.ref.value) - 6).attr('text-anchor', 'start').text(o.ref.label);
    }
    const curve = o.step ? d3.curveStepAfter : o.linear ? d3.curveLinear : d3.curveMonotoneX;
    const hov = [];
    lines.forEach((s) => {
      const yy = s.right ? y2 : y;
      const pts = data.map((d, i) => [cxOf(i), v(d, s.key)]).filter((p) => p[1] != null).map((p) => [p[0], yy(p[1])]);
      if (s.type === 'area') {
        svg.append('path').attr('d', d3.area().curve(curve).x((p) => p[0]).y0(yy(Math.max(0, yy.domain()[0]))).y1((p) => p[1])(pts))
          .style('fill', C.grad(svg, s.color, 0.32, 0.02));
      }
      svg.append('path').attr('d', d3.line().curve(curve)(pts)).attr('fill', 'none').style('stroke', s.color)
        .attr('stroke-width', s.width || 2.4).attr('stroke-linecap', 'round').attr('stroke-dasharray', s.dash ? '6 5' : null);
      const lp = pts[pts.length - 1];
      if (lp && !s.dash) {
        svg.append('circle').attr('cx', lp[0]).attr('cy', lp[1]).attr('r', 7).style('fill', s.color).attr('opacity', 0.18);
        svg.append('circle').attr('cx', lp[0]).attr('cy', lp[1]).attr('r', 3.6).style('fill', '#fff').style('stroke', s.color).attr('stroke-width', 2.2);
      }
      hov.push({ s, yy });
    });
    const guide = svg.append('line').attr('class', 'bz-guide').attr('y1', m.t).attr('y2', h - m.b).attr('opacity', 0);
    const dots = svg.append('g');
    const step = x.step();
    svg.append('g').selectAll('rect').data(data).join('rect')
      .attr('x', (d, i) => cxOf(i) - step / 2).attr('width', step).attr('y', m.t).attr('height', h - m.b - m.t).attr('fill', 'transparent')
      .on('pointerenter pointermove pointerdown', (ev, d) => {
        const i = data.indexOf(d), cx = cxOf(i);
        if (bars.length) hl.attr('x', cx - step / 2 + 2).attr('width', step - 4).attr('opacity', 1);
        guide.attr('x1', cx).attr('x2', cx).attr('opacity', lines.length ? 1 : 0);
        dots.selectAll('*').remove();
        hov.forEach(({ s, yy }) => { const q = v(d, s.key); if (q != null) dots.append('circle').attr('cx', cx).attr('cy', yy(q)).attr('r', 4.5).style('fill', '#fff').style('stroke', s.color).attr('stroke-width', 2.5); });
        C.tipShow(tip, el, w, cx, m.t, (o.tipTitle || o.xFmt || ((q) => q))(xs[i], d),
          S.map((s) => [s.name, s.color, (s.fmt || (s.right ? y2f : yf))(v(d, s.key))]));
      })
      .on('pointerleave', () => { tip.hidden = true; hl.attr('opacity', 0); guide.attr('opacity', 0); dots.selectAll('*').remove(); });
  };

  // 迷你趋势图
  C.spark = function (el, o) {
    el.replaceChildren();
    const w = Math.max(60, el.clientWidth || 120), h = Math.max(28, el.clientHeight || 44);
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('height', h).attr('aria-hidden', 'true');
    svg.append('defs');
    const vals = o.values.map((q) => (q == null ? 0 : +q));
    if (!vals.length) return;
    const col = o.color || C.col.teal;
    if (o.kind === 'bar') {
      const x = d3.scaleBand().domain(d3.range(vals.length)).range([0, w]).padding(0.3);
      const y = d3.scaleLinear().domain([0, d3.max(vals) || 1]).range([h - 2, 2]);
      vals.forEach((q, i) => svg.append('path').attr('d', C.rtop(x(i), y(q), x.bandwidth(), h - 2 - y(q), 2))
        .style('fill', col).attr('opacity', i === vals.length - 1 ? 1 : 0.35));
      return;
    }
    const x = d3.scalePoint().domain(d3.range(vals.length)).range([3, w - 5]);
    const [a, b] = d3.extent(vals);
    const pad = (b - a) * 0.15 || 1;
    const y = d3.scaleLinear().domain([a - pad, b + pad]).range([h - 2, 4]);
    const pts = vals.map((q, i) => [x(i), y(q)]);
    svg.append('path').attr('d', d3.area().curve(d3.curveMonotoneX).x((p) => p[0]).y0(h).y1((p) => p[1])(pts)).style('fill', C.grad(svg, col, 0.3, 0));
    svg.append('path').attr('d', d3.line().curve(d3.curveMonotoneX)(pts)).attr('fill', 'none').style('stroke', col).attr('stroke-width', 1.8);
    const lp = pts[pts.length - 1];
    svg.append('circle').attr('cx', lp[0]).attr('cy', lp[1]).attr('r', 3).style('fill', col);
  };

  // 环形图，中心大数字；legend: 'right' | 'below'
  C.donut = function (el, o) {
    const data = o.data.filter((d) => +d[o.value] > 0);
    const narrow = (el.clientWidth || 400) < 380;
    const h = o.h || (narrow ? 200 + data.length * 24 : 210);
    const { svg, w, tip } = C.base(el, h, o.aria);
    const total = d3.sum(data, (d) => +d[o.value]);
    const r = narrow ? Math.min(w / 2 - 20, 88) : Math.max(54, Math.min(h / 2 - 10, 92, (w - 230) / 2));
    const cx = narrow ? w / 2 : Math.min(w * 0.32, r + 26), cy = narrow ? r + 10 : h / 2;
    const arc = d3.arc().innerRadius(r * 0.68).outerRadius(r).cornerRadius(4).padAngle(0.022);
    const arcH = d3.arc().innerRadius(r * 0.68).outerRadius(r + 6).cornerRadius(4).padAngle(0.022);
    const pie = d3.pie().sort(null).value((d) => +d[o.value]);
    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
    g.append('circle').attr('r', r * 0.6).style('fill', '#f4faf7');
    const cols = o.colors;
    g.selectAll('path').data(pie(data)).join('path').attr('d', arc).style('fill', (d, i) => cols[i % cols.length])
      .on('pointerenter pointerdown', function (ev, d) {
        d3.select(this).attr('d', arcH);
        C.tipShow(tip, el, w, cx + r * 0.4, 6, d.data[o.name], [[o.valueName || '数值', cols[d.index % cols.length], (o.fmt || C.f.int)(+d.data[o.value])], ['占比', C.col.grey, C.f.pct(+d.data[o.value] / total)]]);
      })
      .on('pointerleave', function () { d3.select(this).attr('d', arc); tip.hidden = true; });
    g.append('text').attr('class', 'bz-donut-v').attr('text-anchor', 'middle').attr('dy', '0.15em').text(o.centerValue(total));
    g.append('text').attr('class', 'bz-donut-l').attr('text-anchor', 'middle').attr('dy', '1.75em').text(o.centerLabel);
    const lx = narrow ? 12 : cx + r + 26;
    const ly0 = narrow ? cy + r + 22 : cy - (data.length - 1) * 14;
    data.forEach((d, i) => {
      const row = svg.append('g').attr('transform', `translate(${lx},${ly0 + i * (narrow ? 24 : 28)})`);
      row.append('circle').attr('r', 5).attr('cx', 5).style('fill', cols[i % cols.length]);
      row.append('text').attr('class', 'bz-lbl').attr('x', 18).attr('dy', '0.35em').text(d[o.name]);
      const nameW = C.textW(svg, data.map((q) => q[o.name]), 'bz-lbl');
      const valW = C.textW(svg, data.map((q) => (o.fmt || C.f.int)(+q[o.value])), 'bz-val-b');
      if (18 + nameW + 12 + valW + 46 <= w - lx) row.append('text').attr('class', 'bz-val-b').attr('x', w - lx - 46).attr('dy', '0.35em').attr('text-anchor', 'end').text((o.fmt || C.f.int)(+d[o.value]));
      row.append('text').attr('class', 'bz-val').attr('x', w - lx - 4).attr('dy', '0.35em').attr('text-anchor', 'end').text(C.f.pct0(+d[o.value] / total));
    });
  };

  // 半圆仪表盘；中心数值由页面上叠放的元素显示
  C.gauge = function (el, o) {
    const h = o.h || 150;
    const { svg, w, tip } = C.base(el, h, o.aria);
    tip.remove();
    const r = Math.min(w / 2 - 16, h - 22);
    const cx = w / 2, cy = h - 12;
    const a = d3.scaleLinear().domain([0, o.max]).range([-Math.PI / 2, Math.PI / 2]).clamp(true);
    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);
    const th = Math.max(12, r * 0.17);
    const arc = d3.arc().innerRadius(r - th).outerRadius(r).cornerRadius(th / 2);
    g.append('path').attr('d', arc({ startAngle: -Math.PI / 2, endAngle: Math.PI / 2 })).style('fill', '#ecf3f0');
    if (o.bands) {
      let prev = 0;
      const band = d3.arc().innerRadius(r + 4).outerRadius(r + 8);
      o.bands.forEach((b) => { g.append('path').attr('d', band({ startAngle: a(prev), endAngle: a(b.to) })).style('fill', b.color).attr('opacity', 0.85); prev = b.to; });
    }
    const col = o.color || C.col.teal;
    const val = Math.max(0, +o.value || 0);
    g.append('path').attr('d', arc({ startAngle: -Math.PI / 2, endAngle: a(val) }))
      .style('fill', C.grad(svg, o.color2 || C.col.mint, 1, 1, true, col));
    const ang = a(val), rr = r - th / 2;
    g.append('circle').attr('cx', Math.sin(ang) * rr).attr('cy', -Math.cos(ang) * rr).attr('r', th * 0.62).style('fill', '#fff').style('stroke', col).attr('stroke-width', 3);
    if (o.target != null) {
      const t = a(o.target);
      g.append('line').attr('x1', Math.sin(t) * (r - th - 4)).attr('y1', -Math.cos(t) * (r - th - 4)).attr('x2', Math.sin(t) * (r + 10)).attr('y2', -Math.cos(t) * (r + 10))
        .style('stroke', C.col.ink).attr('stroke-width', 2).attr('stroke-linecap', 'round');
    }
    const lf = o.labelFmt || C.f.pct0;
    g.append('text').attr('class', 'bz-tick').attr('x', -r + th / 2).attr('y', 12).attr('text-anchor', 'middle').text(lf(0));
    g.append('text').attr('class', 'bz-tick').attr('x', r - th / 2).attr('y', 12).attr('text-anchor', 'middle').text(lf(o.max));
  };

  // 小进度环（返回节点）
  C.ring = function (val, color, size, label) {
    const s = size || 56, th = Math.max(5, s * 0.12), r = s / 2 - th / 2 - 1;
    const svg = d3.create('svg').attr('viewBox', `0 0 ${s} ${s}`).attr('width', s).attr('height', s).attr('role', 'img').attr('aria-label', label || '');
    const c = 2 * Math.PI * r;
    svg.append('circle').attr('cx', s / 2).attr('cy', s / 2).attr('r', r).attr('fill', 'none').style('stroke', '#e8f1ed').attr('stroke-width', th);
    svg.append('circle').attr('cx', s / 2).attr('cy', s / 2).attr('r', r).attr('fill', 'none').style('stroke', color).attr('stroke-width', th)
      .attr('stroke-linecap', 'round').attr('stroke-dasharray', `${c * Math.max(0, Math.min(1, val))} ${c}`).attr('transform', `rotate(-90 ${s / 2} ${s / 2})`);
    svg.append('text').attr('x', s / 2).attr('y', s / 2).attr('dy', '0.35em').attr('text-anchor', 'middle').attr('class', 'bz-ring-t').text(label || '');
    return svg.node();
  };

  // 雷达图：axes [{key,label,fmt,max?}]，series [{name,color,row}]
  C.radar = function (el, o) {
    const h = o.h || 290;
    const { svg, w, tip } = C.base(el, h, o.aria);
    const n = o.axes.length, cx = w / 2, cy = h / 2 + 2;
    const lblW = C.textW(svg, o.axes.map((a) => a.label), 'bz-lbl');
    const R = Math.max(50, Math.min(w / 2 - lblW - 14, h / 2 - 26));
    const ang = (i) => (i / n) * 2 * Math.PI;
    const pt = (i, t) => [cx + Math.sin(ang(i)) * R * t, cy - Math.cos(ang(i)) * R * t];
    const maxOf = o.axes.map((a) => a.max || d3.max(o.series, (s) => +s.row[a.key]) * 1.12 || 1);
    [0.25, 0.5, 0.75, 1].forEach((t, k) => {
      svg.append('path').attr('d', d3.line().curve(d3.curveLinearClosed)(o.axes.map((a, i) => pt(i, t))))
        .style('fill', k % 2 ? '#f5faf8' : '#fff').style('stroke', '#e2ece8');
    });
    o.axes.forEach((a, i) => {
      const [x2, y2] = pt(i, 1);
      svg.append('line').attr('x1', cx).attr('y1', cy).attr('x2', x2).attr('y2', y2).style('stroke', '#e2ece8');
      const [lx, ly] = pt(i, 1.1);
      const sx = Math.sin(ang(i));
      svg.append('text').attr('class', 'bz-lbl').attr('x', lx).attr('y', ly).attr('dy', '0.35em')
        .attr('text-anchor', Math.abs(sx) < 0.2 ? 'middle' : sx > 0 ? 'start' : 'end').text(a.label);
    });
    o.series.forEach((s) => {
      const pts = o.axes.map((a, i) => pt(i, Math.min(1, Math.max(0.04, +s.row[a.key] / maxOf[i]))));
      svg.append('path').attr('d', d3.line().curve(d3.curveCardinalClosed.tension(0.25))(pts))
        .style('fill', s.color).attr('fill-opacity', 0.2).style('stroke', s.color).attr('stroke-width', 2).attr('stroke-linejoin', 'round');
      pts.forEach((p) => svg.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', 2.6).style('fill', s.color));
    });
    o.axes.forEach((a, i) => {
      const a0 = ang(i) - Math.PI / n, a1 = ang(i) + Math.PI / n;
      svg.append('path').attr('transform', `translate(${cx},${cy})`)
        .attr('d', d3.arc().innerRadius(0).outerRadius(R * 1.1)({ startAngle: a0, endAngle: a1 })).attr('fill', 'transparent')
        .on('pointerenter pointermove pointerdown', () => {
          const [px] = pt(i, 0.6);
          C.tipShow(tip, el, w, px, 8, a.label, o.series.map((s) => [s.name, s.color, (a.fmt || C.f.int)(+s.row[a.key])]));
        })
        .on('pointerleave', () => { tip.hidden = true; });
    });
  };

  // 梯形漏斗：左侧环节名，右侧逐级转化率
  C.funnel = function (el, o) {
    const data = o.data, n = data.length, rowH = o.rowH || 46, h = n * rowH + 8;
    const { svg, w, tip } = C.base(el, h, o.aria);
    tip.remove();
    const lw = C.textW(svg, data.map((d) => d[o.name]), 'bz-lbl') + 18;
    const rw = 92, span = w - lw - rw, cx = lw + span / 2;
    const wid = (i) => span * (1 - (i * 0.68) / n);
    data.forEach((d, i) => {
      const y0 = i * rowH + 4, y1 = y0 + rowH - 5;
      const wt = wid(i), wb = wid(i + 1);
      const col = o.colors[i % o.colors.length];
      svg.append('path').attr('d', `M${cx - wt / 2},${y0}L${cx + wt / 2},${y0}L${cx + wb / 2},${y1}L${cx - wb / 2},${y1}Z`)
        .style('fill', C.grad(svg, col, 1, 0.78, true, col)).attr('stroke-linejoin', 'round');
      svg.append('text').attr('class', i < 2 && o.lightTop ? 'bz-funnel-v dark' : 'bz-funnel-v').attr('x', cx).attr('y', (y0 + y1) / 2).attr('dy', '0.35em').attr('text-anchor', 'middle').text(C.f.int(+d[o.value]));
      svg.append('text').attr('class', 'bz-lbl').attr('x', lw - 12).attr('y', (y0 + y1) / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(d[o.name]);
      svg.append('line').attr('x1', cx + wt / 2 + 6).attr('x2', w - rw + 4).attr('y1', y0 + 0.5).attr('y2', y0 + 0.5).style('stroke', '#e2ece8').attr('stroke-dasharray', '3 3');
      if (i > 0) {
        const g = svg.append('g').attr('transform', `translate(${w - rw + 10},${y0})`);
        g.append('rect').attr('width', rw - 12).attr('height', 22).attr('y', -11).attr('rx', 11).style('fill', '#eef7f3');
        g.append('text').attr('class', 'bz-conv').attr('x', (rw - 12) / 2).attr('dy', '0.35em').attr('text-anchor', 'middle')
          .text('↓ ' + C.f.pct(+d[o.value] / +data[i - 1][o.value]));
      }
    });
  };

  // 横向条形：单值或堆叠，可选标记线（预算/合同额）与竖向参考线
  C.hbars = function (el, o) {
    const data = o.data, rowH = o.rowH || 32, h = data.length * rowH + (o.ref ? 26 : 8);
    const { svg, w, tip } = C.base(el, h, o.aria);
    const series = o.series, v = (d, k) => +d[k] || 0, tot = (d) => d3.sum(series, (s) => v(d, s.key));
    const fmt = o.fmt || C.f.int;
    let max = o.max || d3.max(data, (d) => Math.max(tot(d), o.marker ? v(d, o.marker.key) : 0));
    if (o.ref) max = Math.max(max, o.ref.value);
    const lw = Math.min(w * 0.42, C.textW(svg, data.map(o.label), 'bz-lbl') + 14);
    const vt = (d) => (o.valueText ? o.valueText(d) : fmt(tot(d)));
    const vw = C.textW(svg, data.map(vt), 'bz-val-b') + 14;
    const x = d3.scaleLinear().domain([0, max || 1]).range([lw, w - vw]);
    const y = d3.scaleBand().domain(data.map((d, i) => i)).range([4, data.length * rowH + 4]).padding(o.thin ? 0.55 : 0.4);
    const bh = y.bandwidth(), rr = bh / 2;
    const fills = series.map((s) => C.grad(svg, s.color, 0.75, 1, true));
    data.forEach((d, i) => {
      svg.append('text').attr('class', 'bz-lbl').attr('x', lw - 10).attr('y', y(i) + bh / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text(o.label(d));
      svg.append('rect').attr('x', lw).attr('width', w - vw - lw).attr('y', y(i)).attr('height', bh).attr('rx', rr).style('fill', '#eff5f2');
      const id = 'bzc' + ++uid;
      svg.select('defs').append('clipPath').attr('id', id).append('rect').attr('x', lw).attr('y', y(i)).attr('height', bh).attr('rx', rr)
        .attr('width', Math.max(0, x(tot(d)) - lw));
      const g = svg.append('g').attr('clip-path', `url(#${id})`);
      let acc = 0;
      series.forEach((s, si) => {
        const q = v(d, s.key);
        g.append('rect').attr('x', x(acc)).attr('width', Math.max(0, x(acc + q) - x(acc))).attr('y', y(i)).attr('height', bh)
          .style('fill', o.colorBy ? o.colorBy(d) : fills[si]);
        acc += q;
      });
      if (o.marker) {
        const mx = x(v(d, o.marker.key));
        svg.append('line').attr('class', 'bz-marker').attr('x1', mx).attr('x2', mx).attr('y1', y(i) - 4).attr('y2', y(i) + bh + 4);
      }
      svg.append('text').attr('class', 'bz-val-b').attr('x', w - vw + 8).attr('y', y(i) + bh / 2).attr('dy', '0.35em').text(vt(d));
    });
    if (o.ref) {
      const rx = x(o.ref.value);
      svg.append('line').attr('class', 'bz-ref').attr('x1', rx).attr('x2', rx).attr('y1', 0).attr('y2', h - 20);
      svg.append('text').attr('class', 'bz-ref-t').attr('x', rx).attr('y', h - 5).attr('text-anchor', 'middle').text(o.ref.label);
    }
    const step = y.step();
    data.forEach((d, i) => {
      svg.append('rect').attr('x', 0).attr('width', w).attr('y', y(i) - (step - bh) / 2).attr('height', step).attr('fill', 'transparent')
        .on('pointerenter pointermove pointerdown', () => {
          const rows = o.tipRows ? o.tipRows(d) : series.map((s) => [s.name, s.color, fmt(v(d, s.key))]);
          C.tipShow(tip, el, w, Math.min(x(tot(d)), w * 0.6), y(i) + bh + 6, o.label(d), rows);
        })
        .on('pointerleave', () => { tip.hidden = true; });
    });
  };

  // 气泡图
  C.bubble = function (el, o) {
    const data = o.data, h = o.h || 260;
    const { svg, w, tip } = C.base(el, h, o.aria);
    const X = o.x, Y = o.y;
    const xs = data.map(X.get), ys = data.map(Y.get);
    const y = d3.scaleLinear().domain([0, d3.max(ys) * 1.25]).nice(4);
    const m = { t: 14, b: 40, l: C.textW(svg, y.ticks(4).map(Y.fmt)) + 14, r: 18 };
    y.range([h - m.b, m.t]);
    const [x0, x1] = d3.extent(xs), pad = (x1 - x0) * 0.25 || 10;
    const x = d3.scaleLinear().domain([Math.max(0, x0 - pad), x1 + pad]).nice(4).range([m.l, w - m.r]);
    const r = d3.scaleSqrt().domain([0, d3.max(data, o.r)]).range([0, Math.min(30, w / 14)]);
    C.gridY(svg, y, m.l, w - m.r, Y.fmt);
    x.ticks(5).forEach((t) => svg.append('text').attr('class', 'bz-tick').attr('x', x(t)).attr('y', h - m.b + 18).attr('text-anchor', 'middle').text(X.fmt(t)));
    svg.append('text').attr('class', 'bz-axis-t').attr('x', w - m.r).attr('y', h - 4).attr('text-anchor', 'end').text(X.label);
    svg.append('text').attr('class', 'bz-axis-t').attr('x', m.l + 4).attr('y', 6).text(Y.label);
    const order = data.map((d, i) => i).sort((a, b) => o.r(data[b]) - o.r(data[a]));
    const placed = [];
    const lblY = {};
    data.map((d, i) => i).sort((a, b) => y(ys[a]) - y(ys[b])).forEach((i) => {
      const lx = x(xs[i]) + r(o.r(data[i])) + 5, lw2 = C.textW(svg, [data[i][o.name]], 'bz-lbl-s');
      let ly = y(ys[i]);
      let moved = true;
      while (moved) { moved = false; placed.forEach((p) => { if (Math.abs(p.y - ly) < 13.5 && lx < p.x + p.w && p.x < lx + lw2) { ly = p.y + 14; moved = true; } }); }
      placed.push({ x: lx, y: ly, w: lw2 });
      lblY[i] = ly;
    });
    const circ = data.map((d, i) => ({ cx: x(xs[i]), cy: y(ys[i]), r: r(o.r(d)) }));
    const hitsBubble = (i, x0, x1, yy) => circ.some((c, j) => j !== i && x1 > c.cx - c.r && x0 < c.cx + c.r && Math.abs(yy - c.cy) < c.r + 7);
    const placedL = [];
    order.forEach((i) => {
      const d = data[i], col = o.colors[i % o.colors.length];
      const cx = x(xs[i]), cy = y(ys[i]), rr = r(o.r(d));
      svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', rr).style('fill', C.grad(svg, col, 0.9, 0.55)).style('stroke', '#fff').attr('stroke-width', 2)
        .on('pointerenter pointerdown', () => C.tipShow(tip, el, w, cx, Math.max(0, cy - 30), d[o.name], o.tipRows(d, col)))
        .on('pointerleave', () => { tip.hidden = true; });
      const tw = C.textW(svg, [d[o.name]], 'bz-lbl-s');
      let lx = cx + rr + 5, ly = lblY[i], anchor = 'start';
      if (hitsBubble(i, lx, lx + tw, ly)) {
        if (!hitsBubble(i, cx - rr - 5 - tw, cx - rr - 5, cy)) { lx = cx - rr - 5; ly = cy; anchor = 'end'; }
        else { lx = cx; ly = cy + rr + 12; anchor = 'middle'; }
      }
      const x0 = anchor === 'end' ? lx - tw : anchor === 'middle' ? lx - tw / 2 : lx;
      let guard = 0;
      while (guard++ < 20 && placedL.some((p) => Math.abs(p.y - ly) < 13.5 && x0 < p.x + p.w && p.x < x0 + tw)) ly += 14;
      placedL.push({ x: x0, y: ly, w: tw });
      svg.append('text').attr('class', 'bz-lbl-s').attr('x', lx).attr('y', ly).attr('dy', '0.35em').attr('text-anchor', anchor).text(d[o.name]);
    });
  };

  // 甘特图：时间轴、今天线、进度填充
  C.gantt = function (el, o) {
    const narrow = (el.clientWidth || 600) < 600;
    const rows = o.rows, rowH = o.rowH || (narrow ? 60 : 44), head = 28, h = head + rows.length * rowH + 30;
    const { svg, w, tip } = C.base(el, h, o.aria);
    const lw = narrow ? 0 : Math.min(w * 0.3, Math.max(C.textW(svg, rows.map(o.label), 'bz-lbl-b'), C.textW(svg, rows.map(o.sub), 'bz-sub')) + 20);
    const rw = narrow ? 0 : C.textW(svg, rows.map(o.right), 'bz-val-b') + 18;
    const today = C.date(o.today);
    const t0 = d3.min(rows, (d) => C.date(o.start(d))), t1 = d3.max(rows, (d) => C.date(o.end(d)));
    const x = d3.scaleUtc().domain([d3.utcDay.offset(t0, -6), d3.utcDay.offset(t1, 8)]).range([lw, w - rw]);
    svg.append('rect').attr('x', lw).attr('y', 0).attr('width', w - rw - lw).attr('height', head - 4).attr('rx', 8).style('fill', '#f2f8f5');
    const months = d3.utcMonth.range(d3.utcMonth.ceil(x.domain()[0]), x.domain()[1]);
    const every = Math.max(1, Math.ceil(42 / ((w - rw - lw) / Math.max(1, months.length))));
    months.forEach((m, i) => {
      svg.append('line').attr('class', 'bz-gl').attr('x1', x(m)).attr('x2', x(m)).attr('y1', head - 4).attr('y2', h);
      if (i % every === 0) svg.append('text').attr('class', 'bz-tick').attr('x', x(m) + 6).attr('y', head / 2).attr('dy', '0.2em')
        .text((m.getUTCMonth() === 0 ? m.getUTCFullYear() + '年' : '') + (m.getUTCMonth() + 1) + '月');
    });
    rows.forEach((d, i) => {
      const y0 = head + i * rowH;
      if (i % 2 === 0) svg.append('rect').attr('x', 0).attr('y', y0).attr('width', w).attr('height', rowH).attr('rx', 8).style('fill', '#f8fbfa');
      if (narrow) {
        svg.append('text').attr('class', 'bz-lbl-b').attr('x', 8).attr('y', y0 + 14).attr('dy', '0.35em').text(o.label(d));
        svg.append('text').attr('class', 'bz-val-b').attr('x', w - 8).attr('y', y0 + 14).attr('dy', '0.35em').attr('text-anchor', 'end').style('fill', o.rightColor ? o.rightColor(d) : null).text(o.right(d));
      } else {
        svg.append('text').attr('class', 'bz-lbl-b').attr('x', 8).attr('y', y0 + rowH / 2 - 7).attr('dy', '0.35em').text(o.label(d));
        svg.append('text').attr('class', 'bz-sub').attr('x', 8).attr('y', y0 + rowH / 2 + 9).attr('dy', '0.35em').text(o.sub(d));
      }
      const s = C.date(o.start(d)), e = C.date(o.end(d));
      const bh = 16, bx = x(s), bw = Math.max(8, x(e) - x(s)), by = narrow ? y0 + 32 : y0 + (rowH - bh) / 2;
      const col = o.color(d);
      svg.append('rect').attr('x', bx).attr('y', by).attr('width', bw).attr('height', bh).attr('rx', bh / 2).style('fill', col).attr('opacity', 0.16);
      const p = Math.max(0, Math.min(1, +o.progress(d)));
      if (p > 0) svg.append('rect').attr('x', bx).attr('y', by).attr('width', Math.max(bh, bw * p)).attr('height', bh).attr('rx', bh / 2).style('fill', C.grad(svg, col, 0.7, 1, true));
      if (bw * p > 38) svg.append('text').attr('class', 'bz-bar-t').attr('x', bx + 8).attr('y', by + bh / 2).attr('dy', '0.35em').text(C.f.pct0(p));
      svg.append('circle').attr('cx', x(e)).attr('cy', by + bh / 2).attr('r', 4).style('fill', '#fff').style('stroke', col).attr('stroke-width', 2);
      if (!narrow) svg.append('text').attr('class', 'bz-val-b').attr('x', w - rw + 10).attr('y', y0 + rowH / 2).attr('dy', '0.35em').style('fill', o.rightColor ? o.rightColor(d) : null).text(o.right(d));
      svg.append('rect').attr('x', 0).attr('y', y0).attr('width', w).attr('height', rowH).attr('fill', 'transparent')
        .on('pointerenter pointermove pointerdown', () => C.tipShow(tip, el, w, Math.min(x(e), w * 0.62), y0 + rowH, o.label(d), o.tipRows(d)))
        .on('pointerleave', () => { tip.hidden = true; });
    });
    const tx = x(today);
    svg.append('line').attr('class', 'bz-today').attr('x1', tx).attr('x2', tx).attr('y1', head - 4).attr('y2', h - 20);
    const tg = svg.append('g').attr('transform', `translate(${tx},${h - 11})`);
    tg.append('rect').attr('x', -22).attr('y', -9).attr('width', 44).attr('height', 18).attr('rx', 9).style('fill', C.col.coral);
    tg.append('text').attr('class', 'bz-today-t').attr('text-anchor', 'middle').attr('dy', '0.35em').text('今天');
  };

  // 头像
  const avCols = [['#0f7b65', '#0b6656'], ['#3a6fd0', '#2852a3'], ['#956009', '#7a4e06'], ['#6b52d6', '#4f38b3'], ['#c4492d', '#9e341d']];
  C.avatar = function (name, size) {
    const d = document.createElement('div'); d.className = 'bz-av';
    const k = [...String(name)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % avCols.length;
    d.style.background = `linear-gradient(135deg, ${avCols[k][0]}, ${avCols[k][1]})`;
    if (size) { d.style.width = d.style.height = size + 'px'; d.style.fontSize = Math.round(size * 0.42) + 'px'; }
    d.textContent = [...String(name)][0] || '';
    return d;
  };

  C.meter = function (val, color, text) {
    const wrap = document.createElement('div'); wrap.className = 'bz-meter';
    const bar = document.createElement('div'); bar.className = 'bz-meter-bar';
    const fill = document.createElement('i'); fill.style.width = Math.max(0, Math.min(1, val)) * 100 + '%'; fill.style.background = color;
    bar.appendChild(fill);
    const t = document.createElement('span'); t.textContent = text;
    wrap.append(bar, t);
    return wrap;
  };
  C.pill = function (text, kind) { const s = document.createElement('span'); s.className = 'bz-pill bz-pill-' + kind; s.textContent = text; return s; };
  C.el = function (tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  C.tbody = function (tb, rows, cols) {
    tb.replaceChildren();
    rows.forEach((d) => {
      const tr = document.createElement('tr');
      cols.forEach((c) => {
        const td = document.createElement('td');
        if (c.cls) td.className = c.cls;
        const out = c.render ? c.render(d) : C.fmt(c.fmt || 'raw', d[c.f]);
        if (out instanceof Node) td.appendChild(out); else td.textContent = out;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  };
})();
