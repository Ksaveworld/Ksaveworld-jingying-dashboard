const K = C.col;

// ---------- 通用绘制 ----------
dash.draw('v', (el) => {
  const s = dash.data(el.dataset.source);
  if (s.status !== 'ok' || !s.data) { el.textContent = '—'; return; }
  const row = Array.isArray(s.data) ? s.data[+(el.dataset.row || 0)] : s.data;
  const v = row ? row[el.dataset.field] : null;
  el.textContent = C.fmt(el.dataset.fmt || 'int', v);
  if (el.classList.contains('att')) el.classList.toggle('att-miss', v != null && v < 1);
  if (el.dataset.good) {
    const good = el.dataset.good === 'up' ? v > 0 : v < 0;
    el.classList.toggle('bz-good', v != null && v !== 0 && good);
    el.classList.toggle('bz-bad', v != null && v !== 0 && !good);
    el.classList.toggle('bz-up', v > 0);
    el.classList.toggle('bz-down', v < 0);
  }
});

// 迷你图：data-col 指定列，data-kind=area|bar，data-color
dash.draw('spark', (el) => {
  const s = dash.data(el.dataset.source);
  if (s.status !== 'ok' || !Array.isArray(s.data)) { el.replaceChildren(); return; }
  C.spark(el, { values: s.data.map((r) => r[el.dataset.col]), kind: el.dataset.kind, color: el.dataset.color });
});

// 仪表盘：data-col / data-row 取值，data-max 量程，data-target 目标线，data-bands="0.6:#f06b47,0.9:#f5b83d,1.2:#14957a"
dash.draw('gauge', (el) => {
  const s = dash.data(el.dataset.source);
  if (s.status !== 'ok' || !s.data) { el.replaceChildren(); return; }
  const row = s.data[+(el.dataset.row || 0)];
  const bands = (el.dataset.bands || '').split(',').filter(Boolean).map((b) => { const [to, color] = b.split(':'); return { to: +to, color }; });
  C.gauge(el, { value: +row[el.dataset.col], max: +el.dataset.max, target: el.dataset.target ? +el.dataset.target : null,
    color: el.dataset.color || K.teal, color2: el.dataset.color2, bands: bands.length ? bands : null, h: +el.dataset.h || 140,
    labelFmt: el.dataset.lf === 'int' ? C.f.int : C.f.pct0 });
});

dash.draw('alert_count', (el) => {
  const s = dash.data('alerts');
  if (s.status !== 'ok') { el.textContent = '—'; return; }
  const lv = el.dataset.level, ar = el.dataset.area;
  el.textContent = s.data.filter((r) => (!lv || r.level === lv) && (!ar || r.area === ar)).length;
});

(function tabs() {
  const ids = ['ov', 'wb', 'edu', 'prod', 'ai', 'sales', 'all'];
  const open = (id) => {
    const allow = window.__tabAllow ? window.__tabAllow() : ids;
    if (!ids.includes(id) || !allow.includes(id)) id = allow[0];
    document.querySelectorAll('.bz-sec').forEach((s) => { s.hidden = s.id !== id; });
    document.querySelectorAll('.bz-tab').forEach((b) => {
      const on = b.dataset.tab === id;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    dash.setLink(id === 'ov' ? null : id);
  };
  document.querySelectorAll('.bz-tab').forEach((b) => b.addEventListener('click', () => open(b.dataset.tab)));
  document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => { open(b.dataset.goto); window.scrollTo({ top: 0 }); }));
  window.__openTab = open;
  open((location.hash || '').slice(1));
  let printed = null;
  window.addEventListener('beforeprint', () => {
    if (printed) return;
    printed = [...document.querySelectorAll('.bz-sec')].map((s) => [s, s.hidden]);
    printed.forEach(([s]) => { s.hidden = false; });
  });
  window.addEventListener('afterprint', () => { if (!printed) return; printed.forEach(([s, h]) => { s.hidden = h; }); printed = null; });
})();

// 预警信息流：data-area 逗号分隔，data-limit 条数
dash.draw('alerts', (el) => {
  const got = C.need(el, ['alerts']); if (!got) return;
  const areas = (el.dataset.area || '').split(',').filter(Boolean);
  let rows = got[0].filter((r) => !areas.length || areas.includes(r.area));
  const lim = +el.dataset.limit || 0;
  const more = lim && rows.length > lim ? rows.length - lim : 0;
  if (lim) rows = rows.slice(0, lim);
  el.replaceChildren();
  if (!rows.length) { el.appendChild(C.el('div', 'bz-empty', '当前没有触发的预警')); return; }
  rows.forEach((r) => {
    const hi = r.level === '高';
    const li = C.el('div', 'bz-alert ' + (hi ? 'hi' : 'mid'));
    const dot = C.el('div', 'bz-alert-ic');
    const sv = d3.select(dot).append('svg').attr('viewBox', '0 0 24 24').attr('width', 16).attr('height', 16).attr('aria-hidden', 'true');
    sv.append('path').attr('d', hi ? 'M12 4l9 16H3zM12 10v4M12 17h.01' : 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v5M12 16h.01')
      .attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', 2.2).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
    const body = C.el('div', 'bz-alert-b');
    const top = C.el('div', 'bz-alert-top');
    top.append(C.el('b', null, r.type));
    if (areas.length !== 1) top.append(C.el('span', 'bz-alert-area', r.area));
    body.append(top, C.el('div', 'bz-alert-item', r.item), C.el('div', 'bz-alert-detail', r.detail));
    li.append(dot, body);
    el.appendChild(li);
  });
  if (more) el.appendChild(C.el('div', 'bz-more', '另有 ' + more + ' 条，见「综合看板」'));
});

// 各板块风险数量
dash.draw('risk_tiles', (el) => {
  const got = C.need(el, ['alerts']); if (!got) return;
  const areas = ['财务', '招生', '制作', 'AI服务', '销售', '资源'];
  el.replaceChildren();
  areas.forEach((a) => {
    const rs = got[0].filter((r) => r.area === a);
    const hi = rs.filter((r) => r.level === '高').length;
    const t = C.el('div', 'bz-rt ' + (hi ? 'hi' : rs.length ? 'mid' : 'ok'));
    t.append(C.el('div', 'bz-rt-a', a), C.el('div', 'bz-rt-n', String(rs.length)), C.el('div', 'bz-rt-s', hi ? hi + ' 条高风险' : rs.length ? '需关注' : '正常'));
    el.appendChild(t);
  });
});

// ---------- 总看板 ----------
dash.draw('ov_rev', (el) => {
  const g = C.need(el, ['fin_monthly']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.month, xFmt: C.month, stack: true, yFmt: C.f.wanAxis, h: 280, pad: 0.5,
    series: [{ key: 'rev_prod', name: '漫剧制作', color: K.teal, fmt: C.f.wan }, { key: 'rev_edu', name: '漫剧招生', color: K.mint, fmt: C.f.wan },
      { key: 'rev_ai', name: '企业AI服务', color: K.amber, fmt: C.f.wan }, { key: 'rev_target', name: '月度目标（示例）', color: K.ink, type: 'line', dash: true, fmt: C.f.wan },
      { key: 'collected', name: '回款', color: K.sky, type: 'line', fmt: C.f.wan }] });
});
dash.draw('ov_mix', (el) => {
  const g = C.need(el, ['rev_mix']); if (!g) return;
  C.donut(el, { data: g[0], name: 'business', value: 'revenue', valueName: '累计营收', colors: [K.teal, K.mint, K.amber], fmt: C.f.wan,
    centerValue: (t) => C.f.wan(t), centerLabel: '1–10月累计营收' });
});
dash.draw('ov_profit', (el) => {
  const g = C.need(el, ['fin_monthly']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.month, xFmt: C.month, yFmt: C.f.wanAxis, h: 330,
    series: [{ key: 'gross_profit', name: '毛利', color: K.teal, type: 'area', fmt: C.f.wan }, { key: 'net_profit', name: '净利润', color: K.amber, type: 'area', fmt: C.f.wan },
      { key: 'np_target', name: '净利润目标（示例）', color: K.ink, type: 'line', dash: true, fmt: C.f.wan }] });
});
dash.draw('ov_leads', (el) => {
  const g = C.need(el, ['fin_monthly']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.month, xFmt: C.month, h: 350, pad: 0.55,
    series: [{ key: 'leads_total', name: '线索总量', color: K.mint }, { key: 'new_customers', name: '新签客户', color: K.teal, type: 'line', right: true }] });
});
dash.draw('ov_cash', (el) => {
  const g = C.need(el, ['fin_cash']); if (!g) return;
  const c = g[0][0];
  const rows = [{ k: '账面现金', v: +c.cash_balance, c: K.teal }, { k: '应收账款', v: +c.receivable, c: K.amber }, { k: '应付账款', v: +c.payable, c: K.coral }];
  C.hbars(el, { data: rows, label: (d) => d.k, series: [{ key: 'v', name: '金额', color: K.teal }], colorBy: (d) => d.c, fmt: C.f.wan, rowH: 30, thin: true });
});
const statusCol = (s) => (s === '正常' ? K.teal : s === '临期' ? K.amber : K.coral);
dash.draw('backlog_gantt', (el) => {
  const g = C.need(el, ['backlog']); if (!g) return;
  C.gantt(el, { rows: g[0], today: '2026-10-31', start: (d) => d.start, end: (d) => d.due, progress: (d) => d.progress,
    label: (d) => d.project, sub: (d) => d.business + ' · ' + d.customer, color: (d) => statusCol(d.status),
    right: (d) => (d.days_left < 0 ? '逾期 ' + -d.days_left + ' 天' : '剩 ' + d.days_left + ' 天') + ' · ' + d.status, rightColor: (d) => statusCol(d.status),
    tipRows: (d) => [['合同额', K.grey, C.f.yuan(d.contract)], ['未交付金额', K.sky, C.f.yuan(d.remaining)], ['进度', K.teal, C.f.pct0(d.progress)], ['交付日', K.grey, d.due], ['状态', statusCol(d.status), d.status]] });
});

// ---------- 漫剧招生 ----------
dash.draw('edu_funnel', (el) => {
  const g = C.need(el, ['edu_funnel']); if (!g) return;
  C.funnel(el, { data: g[0], name: 'stage', value: 'count', colors: ['#bfe9db', '#8fdcc4', K.mint, '#25b08e', K.teal], lightTop: true });
});
dash.draw('edu_cost', (el) => {
  const g = C.need(el, ['edu_monthly', 'edu_unit']); if (!g) return;
  const data = g[0].map((r, i) => Object.assign({}, r, { cac: g[1][i] && g[1][i].cac }));
  C.combo(el, { data, x: (d) => d.month, xFmt: C.month, stack: true, yFmt: C.f.wanAxis, h: 270, pad: 0.5,
    series: [{ key: 'ad_spend', name: '广告投放', color: K.teal, fmt: C.f.wan }, { key: 'platform_cost', name: '平台成本', color: K.mint, fmt: C.f.wan },
      { key: 'teach_cost', name: '教学成本', color: K.pale, fmt: C.f.wan }, { key: 'cac', name: '获客成本(元/人)', color: K.coral, type: 'line', right: true, fmt: C.f.yuan }] });
});
dash.draw('edu_bubble', (el) => {
  const g = C.need(el, ['edu_channels']); if (!g) return;
  C.bubble(el, { data: g[0], name: 'channel', colors: [K.teal, K.coral, K.sky, K.violet, K.amber], h: 260,
    x: { get: (d) => +d.spend / +d.leads, fmt: (v) => '¥' + C.f.int(v), label: '单条线索成本 →' },
    y: { get: (d) => +d.enrolled / +d.leads, fmt: C.f.pct0, label: '线索→报名' }, r: (d) => +d.spend,
    tipRows: (d, c) => [['投放', c, C.f.yuan(+d.spend)], ['线索', K.grey, C.f.int(+d.leads)], ['报名', K.grey, C.f.int(+d.enrolled)], ['获客成本', K.coral, C.f.yuan(+d.spend / +d.enrolled)]] });
});
dash.draw('edu_unit', (el) => {
  const g = C.need(el, ['edu_unit']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.month, xFmt: C.month, h: 240,
    series: [{ key: 'cost_per_student', name: '单学员成本', color: K.coral, type: 'area', fmt: C.f.yuan }, { key: 'gross_per_student', name: '单学员毛利', color: K.teal, type: 'area', fmt: C.f.yuan }] });
});
dash.draw('edu_conv', (el) => {
  const g = C.need(el, ['edu_unit']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.month, xFmt: C.month, h: 240, yFmt: C.f.pct0, ref: { value: 0.08, label: '退费红线 8%（示例）' },
    series: [{ key: 'conv', name: '线索→报名', color: K.teal, type: 'area', fmt: C.f.pct }, { key: 'refund_rate', name: '退费率', color: K.coral, type: 'line', fmt: C.f.pct }] });
});
dash.draw('edu_sites', (el) => {
  const g = C.need(el, ['edu_sites']); if (!g) return;
  el.replaceChildren();
  g[0].forEach((s) => {
    const r = +s.completion_rate;
    const card = C.el('div', 'bz-site');
    const ring = C.el('div', 'bz-site-ring');
    ring.appendChild(C.ring(r, r < 0.88 ? K.amber : K.teal, 74, C.f.pct0(r)));
    ring.appendChild(C.el('div', 'bz-site-rl', '结业率'));
    const info = C.el('div', 'bz-site-i');
    info.appendChild(C.el('div', 'bz-site-n', s.site));
    const grid = C.el('div', 'bz-site-g');
    [['班级', s.classes], ['学员', s.students], ['在训', s.in_training], ['已结业', s.graduated], ['退费', s.refunds]].forEach(([k, v]) => {
      const c = C.el('div'); c.append(C.el('span', null, k), C.el('b', k === '退费' ? 'bad' : null, C.f.int(+v))); grid.appendChild(c);
    });
    info.appendChild(grid);
    card.append(ring, info);
    el.appendChild(card);
  });
});
dash.draw('edu_channels_tb', (tb) => {
  const s = dash.data('edu_channels');
  if (s.status !== 'ok') { tb.replaceChildren(); return; }
  C.tbody(tb, s.data, [
    { f: 'channel', cls: 'bz-strong' }, { f: 'spend', fmt: 'int', cls: 'num' }, { f: 'leads', fmt: 'int', cls: 'num' },
    { render: (d) => C.f.int(+d.spend / +d.leads), cls: 'num' }, { f: 'enrolled', fmt: 'int', cls: 'num' },
    { render: (d) => C.f.int(+d.spend / +d.enrolled), cls: 'num' },
    { render: (d) => C.meter(+d.enrolled / +d.leads / 0.1, K.teal, C.f.pct(+d.enrolled / +d.leads)) },
  ]);
});

// ---------- 漫剧制作 ----------
dash.draw('prod_gantt', (el) => {
  const g = C.need(el, ['prod_projects', 'backlog']); if (!g) return;
  const st = {}; g[1].forEach((b) => { st[b.project] = b.status; });
  C.gantt(el, { rows: g[0], today: '2026-10-31', start: (d) => d.start, end: (d) => d.due, progress: (d) => d.progress,
    label: (d) => d.project, sub: (d) => d.customer + ' · ' + d.team + ' · ' + C.f.int(+d.contract) + ' 元',
    color: (d) => statusCol(st[d.project] || '正常'),
    right: (d) => '待交付 ' + C.f.int(+d.pending_sec) + ' 秒', rightColor: (d) => statusCol(st[d.project] || '正常'),
    tipRows: (d) => [['已交付', K.teal, C.f.int(+d.delivered_sec) + ' 秒'], ['待交付', K.sky, C.f.int(+d.pending_sec) + ' 秒'], ['交付日', K.grey, d.due],
      ['剩余天数', K.grey, d.days_left + ' 天'], ['状态', statusCol(st[d.project] || '正常'), st[d.project] || '正常']] });
});
dash.draw('prod_daily', (el) => {
  const g = C.need(el, ['prod_daily']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.date, xFmt: C.day, h: 250, pad: 0.35, step: true,
    series: [{ key: 'output_sec', name: '产出(秒)', color: K.mint }, { key: 'rework_sec', name: '返工(秒)', color: K.coral },
      { key: 'capacity_sec', name: '产能(秒)', color: K.teal, type: 'line', dash: true }] });
});
dash.draw('prod_quality', (el) => {
  const g = C.need(el, ['prod_quality']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.date, xFmt: C.day, h: 230, yFmt: C.f.pct0, ref: { value: 0.10, label: '预警线 10%（示例）' },
    series: [{ key: 'rework_rate', name: '返工率', color: K.coral, type: 'area', fmt: C.f.pct }, { key: 'defect_rate', name: '不合格率', color: K.amber, type: 'area', fmt: C.f.pct }] });
});
dash.draw('team_radar', (el) => {
  const g = C.need(el, ['team_radar']); if (!g) return;
  const cols = [K.teal, K.amber, K.sky, K.violet];
  C.radar(el, { h: 280, series: g[0].map((t, i) => ({ name: t.team, color: cols[i % cols.length], row: t })),
    axes: [{ key: 'capacity', label: '日产能', fmt: (v) => v + ' 秒' }, { key: 'output', label: '日均产出', fmt: (v) => v + ' 秒' },
      { key: 'per_head', label: '人均产出', fmt: (v) => v + ' 秒' }, { key: 'ontime', label: '交付及时率', fmt: C.f.pct, max: 1 },
      { key: 'quality', label: '质量', fmt: C.f.pct, max: 1 }, { key: 'load', label: '负荷', fmt: C.f.pct, max: 1 }] });
});
dash.draw('prod_cost', (el) => {
  const g = C.need(el, ['prod_projects']); if (!g) return;
  C.hbars(el, { data: g[0], label: (d) => d.project.replace(/[《》]/g, ''), rowH: 36,
    series: [{ key: 'cost_compute', name: '算力', color: K.sky }, { key: 'cost_labor', name: '人力', color: K.teal }, { key: 'cost_outsource', name: '外包分成', color: K.amber }],
    marker: { key: 'budget' }, valueText: (d) => '预计毛利 ' + C.f.pct0(+d.est_margin),
    tipRows: (d) => [['算力', K.sky, C.f.yuan(+d.cost_compute)], ['人力', K.teal, C.f.yuan(+d.cost_labor)], ['外包分成', K.amber, C.f.yuan(+d.cost_outsource)],
      ['已发生合计', K.grey, C.f.yuan(+d.cost_total)], ['预算', K.ink, C.f.yuan(+d.budget)], ['预计完工成本', K.coral, C.f.yuan(+d.est_cost_at_finish)]] });
});
dash.draw('prod_teams', (el) => {
  const g = C.need(el, ['prod_teams']); if (!g) return;
  C.hbars(el, { data: g[0], label: (d) => d.team, series: [{ key: 'load', name: '负荷', color: K.teal }], max: 1, rowH: 30, thin: true,
    colorBy: (d) => (+d.load >= 0.95 ? K.coral : +d.load >= 0.85 ? K.amber : K.teal), fmt: C.f.pct0, ref: { value: 0.85, label: '饱和线 85%（示例）' },
    tipRows: (d) => [['人数', K.grey, d.members + ' 人'], ['日产能', K.mint, d.capacity_sec_day + ' 秒'], ['日均产出', K.teal, d.avg_output_sec_day + ' 秒'], ['交付及时率', K.sky, C.f.pct(+d.ontime_rate)]] });
});

// ---------- 企业AI服务 ----------
window.bzAiType = window.bzAiType || '';
document.querySelectorAll('.bz-seg button').forEach((b) => b.addEventListener('click', () => {
  window.bzAiType = b.dataset.type;
  document.querySelectorAll('.bz-seg button').forEach((x) => x.classList.toggle('on', x === b));
  dash.draw('ai_tb');
}));
dash.draw('ai_tb', (tb) => {
  const s = dash.data('ai_contracts');
  if (s.status !== 'ok') { tb.replaceChildren(); return; }
  const rows = s.data.filter((r) => !window.bzAiType || r.type === window.bzAiType);
  C.tbody(tb, rows, [
    { f: 'id', cls: 'bz-mono' }, { f: 'project', cls: 'bz-strong' }, { f: 'customer' },
    { f: 'type', render: (d) => C.pill(d.type, d.type === '定制项目' ? 'teal' : d.type === '运维服务' ? 'sky' : 'amber') },
    { f: 'amount', fmt: 'int', cls: 'num' }, { f: 'received', fmt: 'int', cls: 'num' },
    { f: 'receive_rate', render: (d) => C.meter(+d.receive_rate, +d.receive_rate >= 0.99 ? K.teal : K.mint, C.f.pct0(+d.receive_rate)) },
    { f: 'next_node' }, { f: 'next_node_amount', fmt: 'int', cls: 'num' }, { f: 'next_node_date' },
  ]);
});
dash.draw('ai_pipeline', (el) => {
  const g = C.need(el, ['ai_contracts']); if (!g) return;
  const steps = ['需求确认', '开发', '测试', '上线', '售后运维'];
  el.replaceChildren();
  const head = C.el('div', 'bz-pl-row bz-pl-head');
  head.appendChild(C.el('div'));
  const hs = C.el('div', 'bz-pl-track');
  steps.forEach((s) => hs.appendChild(C.el('div', 'bz-pl-h', s)));
  head.append(hs, C.el('div', 'bz-pl-h', '状态'));
  el.appendChild(head);
  g[0].filter((a) => a.type === '定制项目').forEach((a) => {
    const at = steps.indexOf(a.stage), late = +a.delay_days > 0;
    const row = C.el('div', 'bz-pl-row');
    const nm = C.el('div', 'bz-pl-name');
    nm.append(C.el('b', null, a.project), C.el('span', null, a.customer + ' · 计划 ' + a.plan_date));
    const tr = C.el('div', 'bz-pl-track');
    steps.forEach((s, i) => {
      const cell = C.el('div', 'bz-pl-c' + (i < at ? ' done' : i === at ? (late ? ' cur late' : ' cur') : '') + (i === 0 ? ' first' : ''));
      const node = C.el('i'); node.setAttribute('aria-label', s + (i < at ? ' 已完成' : i === at ? ' 进行中' : ' 未开始'));
      if (i < at) node.textContent = '✓';
      cell.appendChild(node);
      tr.appendChild(cell);
    });
    const st = C.el('div', 'bz-pl-st');
    st.appendChild(late ? C.pill('延期 ' + a.delay_days + ' 天', +a.delay_days > 10 ? 'bad' : 'warn') : C.pill('正常', 'ok'));
    row.append(nm, tr, st);
    el.appendChild(row);
  });
});
dash.draw('ai_mix', (el) => {
  const g = C.need(el, ['ai_mix']); if (!g) return;
  C.donut(el, { data: g[0], name: 'type', value: 'amount', valueName: '合同额', colors: [K.teal, K.sky, K.amber], fmt: C.f.wan,
    centerValue: (t) => C.f.wan(t), centerLabel: '合同总额' });
});
dash.draw('ai_margin', (el) => {
  const g = C.need(el, ['ai_contracts']); if (!g) return;
  C.hbars(el, { data: g[0].filter((a) => a.type === '定制项目'), label: (d) => d.project, rowH: 36,
    series: [{ key: 'cost_rd', name: '研发人力', color: K.teal }, { key: 'cost_compute', name: '算力', color: K.sky }, { key: 'cost_api', name: '第三方接口', color: K.amber }],
    marker: { key: 'amount' }, valueText: (d) => '毛利 ' + C.f.pct0(+d.margin),
    tipRows: (d) => [['研发人力', K.teal, C.f.yuan(+d.cost_rd)], ['算力', K.sky, C.f.yuan(+d.cost_compute)], ['第三方接口', K.amber, C.f.yuan(+d.cost_api)], ['合同额', K.ink, C.f.yuan(+d.amount)], ['毛利率', K.grey, C.f.pct(+d.margin)]] });
});
dash.draw('ai_upsell', (el) => {
  const g = C.need(el, ['ai_monthly']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.month, xFmt: C.month, h: 240, pad: 0.4,
    series: [{ key: 'renew_due', name: '到期客户', color: K.grey }, { key: 'renewed', name: '已续费', color: K.teal },
      { key: 'upsell_amount', name: '增购金额', color: K.amber, type: 'line', right: true, fmt: C.f.yuan }], y2Fmt: C.f.wanAxis });
});
dash.draw('ai_retention', (el) => {
  const g = C.need(el, ['ai_monthly']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.month, xFmt: C.month, h: 240, pad: 0.55,
    series: [{ key: 'tickets', name: '售后工单', color: K.mint }, { key: 'complaints', name: '客户投诉', color: K.coral, type: 'line', right: true }] });
});

// ---------- 企业服务销售 ----------
dash.draw('sales_funnel', (el) => {
  const g = C.need(el, ['sales_funnel']); if (!g) return;
  C.funnel(el, { data: g[0], name: 'stage', value: 'count', colors: ['#cfe0fb', '#9fc0f7', '#6fa0f2', K.sky, '#2f63c9'], lightTop: true, rowH: 74 });
});
dash.draw('sales_radar', (el) => {
  const g = C.need(el, ['sales_radar']); if (!g) return;
  const cols = [K.teal, K.amber];
  C.radar(el, { h: 400, series: g[0].map((r, i) => ({ name: r.group, color: cols[i % 2], row: r })),
    axes: [{ key: 'leads_pp', label: '人均线索' }, { key: 'calls_pp', label: '人均电话' }, { key: 'visits_pp', label: '人均上门', fmt: C.f.d1 },
      { key: 'opp_rate', label: '商机转化', fmt: C.f.pct, max: 0.4 }, { key: 'win_rate', label: '成交率', fmt: C.f.pct, max: 0.5 },
      { key: 'collect_rate', label: '回款率', fmt: C.f.pct, max: 1 }, { key: 'attainment', label: '目标达成', fmt: C.f.pct, max: 1 }] });
});
dash.draw('sales_podium', (el) => {
  const g = C.need(el, ['sales_rank']); if (!g) return;
  const rows = g[0].slice().sort((a, b) => b.won_amount - a.won_amount);
  el.replaceChildren();
  const pod = C.el('div', 'bz-pod');
  [1, 0, 2].forEach((i) => {
    const r = rows[i]; if (!r) return;
    const c = C.el('div', 'bz-pod-c p' + (i + 1));
    const av = C.el('div', 'bz-pod-av');
    av.appendChild(C.avatar(r.rep, i === 0 ? 58 : 48));
    av.appendChild(C.el('span', 'bz-pod-rank', String(i + 1)));
    c.append(av, C.el('div', 'bz-pod-n', r.rep), C.el('div', 'bz-pod-v', C.f.int(r.won_amount)), C.el('div', 'bz-pod-g', r.group + ' · 达成 ' + C.f.pct0(r.attainment)));
    c.appendChild(C.el('div', 'bz-pod-base'));
    pod.appendChild(c);
  });
  el.appendChild(pod);
  const list = C.el('div', 'bz-rk');
  const max = rows[0] ? rows[0].won_amount : 1;
  rows.slice(3).forEach((r, k) => {
    const li = C.el('div', 'bz-rk-r' + (r.flag ? ' last' : ''));
    li.append(C.el('span', 'bz-rk-i', String(k + 4)), C.avatar(r.rep, 26));
    const nm = C.el('div', 'bz-rk-n'); nm.append(C.el('b', null, r.rep), C.el('span', null, r.group));
    const bar = C.el('div', 'bz-rk-bar'); const fi = C.el('i'); fi.style.width = (r.won_amount / max) * 100 + '%'; bar.appendChild(fi);
    li.append(nm, bar, C.el('span', 'bz-rk-v', C.f.int(r.won_amount)));
    if (r.flag) li.appendChild(C.pill('末位', 'bad'));
    list.appendChild(li);
  });
  el.appendChild(list);
});
dash.draw('sales_rank_tb', (tb) => {
  const s = dash.data('sales_rank');
  if (s.status !== 'ok') { tb.replaceChildren(); return; }
  C.tbody(tb, s.data, [
    { f: 'rep', render: (d) => { const w = C.el('div', 'bz-who'); w.append(C.avatar(d.rep, 24), C.el('b', null, d.rep)); return w; } },
    { f: 'group' }, { f: 'rank', fmt: 'int', cls: 'num' },
    { f: 'leads', fmt: 'int', cls: 'num' }, { f: 'calls', fmt: 'int', cls: 'num' }, { f: 'visits', fmt: 'int', cls: 'num' },
    { f: 'opps', fmt: 'int', cls: 'num' }, { f: 'won', fmt: 'int', cls: 'num' }, { f: 'win_rate', fmt: 'pct', cls: 'num' },
    { f: 'won_amount', fmt: 'int', cls: 'num' },
    { f: 'attainment', render: (d) => C.meter(d.attainment, d.attainment >= 1 ? K.teal : d.attainment >= 0.6 ? K.mint : d.attainment >= 0.3 ? K.amber : K.coral, C.f.pct0(d.attainment)) },
    { f: 'collected', fmt: 'int', cls: 'num' },
    { f: 'stale_7d', render: (d) => (d.stale_7d >= 8 ? C.pill(String(d.stale_7d), 'bad') : String(d.stale_7d)), cls: 'num' },
    { f: 'flag', render: (d) => (d.flag ? C.pill('末位', 'bad') : '') },
  ]);
});
dash.draw('sales_actions', (el) => {
  const g = C.need(el, ['sales_reps']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.rep, h: 250, pad: 0.38,
    series: [{ key: 'visits', name: '上门拜访', color: K.teal }, { key: 'opps', name: '商机', color: K.mint }, { key: 'calls', name: '电话联系', color: K.amber, type: 'line', right: true }] });
});
dash.draw('sales_src', (el) => {
  const g = C.need(el, ['sales_src']); if (!g) return;
  C.bubble(el, { data: g[0], name: 'source', colors: [K.teal, K.sky, K.violet, K.coral, K.amber, K.mint], h: 270,
    x: { get: (d) => d.valid_rate, fmt: C.f.pct0, label: '有效线索率 →' }, y: { get: (d) => d.win_rate, fmt: C.f.pct0, label: '线索赢单率' }, r: (d) => d.leads,
    tipRows: (d, c) => [['线索', c, C.f.int(d.leads)], ['有效率', K.grey, C.f.pct(d.valid_rate)], ['商机', K.grey, C.f.int(d.opps)], ['成交', K.teal, C.f.int(d.won)], ['赢单率', K.teal, C.f.pct(d.win_rate)]] });
});
dash.draw('sales_lost', (el) => {
  const g = C.need(el, ['sales_lost']); if (!g) return;
  C.donut(el, { data: g[0], name: 'reason', value: 'count', valueName: '单数', colors: [K.coral, '#f38a6b', K.amber, '#f7cf7a', K.sky, K.violet],
    centerValue: (t) => String(t), centerLabel: '丢单数', h: 230 });
});
dash.draw('sales_stale', (el) => {
  const g = C.need(el, ['sales_stale']); if (!g) return;
  C.hbars(el, { data: g[0], label: (d) => d.reason, series: [{ key: 'count', name: '条数', color: K.amber }], rowH: 40 });
});

// ---------- 综合看板 ----------
dash.draw('alerts_tb', (tb) => {
  const s = dash.data('alerts');
  if (s.status !== 'ok') { tb.replaceChildren(); return; }
  C.tbody(tb, s.data, [
    { f: 'level', render: (d) => C.pill(d.level === '高' ? '高风险' : '关注', d.level === '高' ? 'bad' : 'warn') },
    { f: 'area' }, { f: 'type', cls: 'bz-strong' }, { f: 'item' }, { f: 'detail', cls: 'bz-muted' },
  ]);
});
dash.draw('hr_tb', (tb) => {
  const s = dash.data('hr_eff');
  if (s.status !== 'ok') { tb.replaceChildren(); return; }
  C.tbody(tb, s.data, [
    { f: 'dept', cls: 'bz-strong' }, { f: 'headcount', fmt: 'int', cls: 'num' },
    { f: 'revenue_ytd', fmt: 'int', cls: 'num' }, { f: 'per_head_w', fmt: 'd1', cls: 'num' },
    { f: 'labor_cost_ytd', fmt: 'int', cls: 'num' }, { f: 'labor_ratio', fmt: 'pct', cls: 'num' },
    { f: 'load', render: (d) => C.meter(d.load, d.load >= 0.95 ? K.coral : d.load >= 0.85 ? K.amber : K.teal, C.f.pct0(d.load)) },
  ]);
});
dash.draw('hr_eff_ch', (el) => {
  const g = C.need(el, ['hr_eff']); if (!g) return;
  C.hbars(el, { data: g[0].filter((d) => d.per_head_w != null), label: (d) => d.dept, series: [{ key: 'per_head_w', name: '人均产值(万)', color: K.teal }],
    fmt: (v) => C.f.d1(v) + ' 万/人', rowH: 34 });
});
dash.draw('fin_trend', (el) => {
  const g = C.need(el, ['fin_monthly']); if (!g) return;
  const data = g[0].map((r) => Object.assign({}, r, { cost_all: +r.cogs + +r.opex }));
  C.combo(el, { data, x: (d) => d.month, xFmt: C.month, yFmt: C.f.wanAxis, h: 260,
    series: [{ key: 'revenue', name: '营收', color: K.teal, type: 'area', fmt: C.f.wan }, { key: 'cost_all', name: '总成本费用', color: K.coral, type: 'line', fmt: C.f.wan },
      { key: 'net_profit', name: '净利润', color: K.amber, type: 'area', fmt: C.f.wan }] });
});
dash.draw('ar_aging', (el) => {
  const g = C.need(el, ['ar_aging']); if (!g) return;
  C.donut(el, { data: g[0], name: 'bucket', value: 'amount', valueName: '金额', colors: [K.teal, K.amber, '#f39a52', K.coral], fmt: C.f.wan,
    centerValue: (t) => C.f.wan(t), centerLabel: '应收合计' });
});
dash.draw('res_gpu', (el) => {
  const g = C.need(el, ['res_compute']); if (!g) return;
  C.combo(el, { data: g[0], x: (d) => d.month, xFmt: C.month, stack: true, h: 260, pad: 0.5,
    series: [{ key: 'gpu_h_prod', name: '漫剧制作', color: K.teal }, { key: 'gpu_h_ai', name: '企业AI服务', color: K.sky }, { key: 'gpu_h_edu', name: '漫剧招生', color: K.mint },
      { key: 'budget_h', name: '预算', color: K.coral, type: 'line', dash: true }], linear: true });
});
dash.draw('res_load', (el) => {
  const g = C.need(el, ['prod_teams', 'hr_depts']); if (!g) return;
  const rows = g[0].map((t) => ({ k: '制作' + t.team, load: +t.load })).concat(g[1].map((d) => ({ k: d.dept, load: +d.load }))).sort((a, b) => b.load - a.load);
  C.hbars(el, { data: rows, label: (d) => d.k, series: [{ key: 'load', name: '负荷', color: K.teal }], max: 1, rowH: 28, thin: true, fmt: C.f.pct0,
    colorBy: (d) => (d.load >= 0.95 ? K.coral : d.load >= 0.85 ? K.amber : K.teal), ref: { value: 0.85, label: '饱和线 85%（示例）' } });
});
