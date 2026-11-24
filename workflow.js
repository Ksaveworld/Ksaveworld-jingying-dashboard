// 业务工作流层：岗位视图与权限隔离（R13）、应收分期与核销（R01/R11）、风险处置（R03）、
// 接单评估（R02）、质检与交付批次（R06/R07）、退费与转班（R05）、商机跟进（R10/R11）、
// AI 里程碑（R08）、人效复核（R12）、协作授权与操作留痕（R13）。
// 演示数据保存在浏览器本地（localStorage），右上角「重置演示」可恢复初始状态。
(function () {
  const C = window.C;
  const D = window.__SAMPLE_DATA;
  const KEY = 'ceo-cockpit-demo-v1';
  const nf = (v) => (v == null || isNaN(v) ? '—' : Math.round(v).toLocaleString('zh-CN'));
  const yuan = (v) => '¥' + nf(v);
  const pct = (v) => (v == null || isNaN(v) ? '—' : (v * 100).toFixed(1) + '%');

  // ---------- 小工具 ----------
  function h(sel, attrs, ...kids) {
    const [tag, ...cls] = sel.split('.');
    const e = document.createElement(tag || 'div');
    if (cls.length) e.className = cls.join(' ');
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.style.cssText = v;
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(9).forEach((k) => { if (k == null || k === false) return; e.append(k instanceof Node ? k : String(k)); });
    return e;
  }
  const pill = (t, k) => C.pill(t, k);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- 岗位与权限 ----------
  const ROLES = {
    ceo: { name: 'CEO', who: '张总', scope: '全公司 · 经营、风险与资源汇总', tabs: ['ov', 'wb', 'edu', 'prod', 'ai', 'sales', 'all'], acts: ['查看汇总', '查看明细', '复核关闭风险', '分派风险'] },
    finance: { name: '财务', who: '李会计', scope: '授权核算主体 · 收入、应收、核销', tabs: ['wb', 'ov', 'ai', 'all'], acts: ['核销到账', '确认退款', '复核里程碑转应收', '导出'] },
    sales_mgr: { name: '销售主管', who: '王经理（一组）', scope: '一组全部商机与组内对比', tabs: ['wb', 'sales'], acts: ['分配线索', '复核人效更正', '处置销售风险'] },
    sales: { name: '销售', who: '陈思远（一组）', scope: '本人客户、本人商机', tabs: ['wb', 'sales'], acts: ['记录跟进', '登记付款答复', '标记丢单', '提交人效更正'] },
    prod_lead: { name: '制作负责人', who: '周导（A组）', scope: 'A组在制项目 · 派工、组批、对客交付', tabs: ['wb', 'prod'], acts: ['组成交付批次', '登记对客提交', '接单评估', '处置制作风险'] },
    qc: { name: '质检', who: '赵琳', scope: '分配给本人的质检任务', tabs: ['wb'], acts: ['质检通过', '质检退回'] },
    edu_lead: { name: '培训负责人', who: '钱主管', scope: '招生渠道、各地点班次', tabs: ['wb', 'edu'], acts: ['处置招生风险', '查看地点统计'] },
    teacher: { name: '班务', who: '孙老师（杭州）', scope: '分配给本人的班次', tabs: ['wb'], acts: ['转班', '登记退费申请', '登记结业'] },
    ai_lead: { name: 'AI服务负责人', who: '郑工', scope: '企业AI服务项目、里程碑、工单', tabs: ['wb', 'ai'], acts: ['复核里程碑', '登记客户验收', '接单评估', '处置AI风险'] },
    admin: { name: '权限管理员', who: '系统管理员', scope: '账号、组织与授权配置（不含业务明细）', tabs: ['wb'], acts: ['审批协作授权', '撤销授权', '查看变更记录'] },
  };
  const ROLE_ORDER = ['ceo', 'finance', 'sales_mgr', 'sales', 'prod_lead', 'qc', 'edu_lead', 'teacher', 'ai_lead', 'admin'];
  // 工作台模块 × 岗位：v 查看，e 录入/办理，r 复核
  const MODS = [
    ['todo', '我的待办', { ceo: 'v', finance: 'v', sales_mgr: 'v', sales: 'v', prod_lead: 'v', qc: 'v', edu_lead: 'v', teacher: 'v', ai_lead: 'v', admin: 'v' }],
    ['ar', '应收分期与核销', { ceo: 'v', finance: 'e', sales_mgr: 'v', sales: 'e', ai_lead: 'v' }],
    ['risk', '风险处置', { ceo: 'r', finance: 'e', sales_mgr: 'e', prod_lead: 'e', edu_lead: 'e', ai_lead: 'e' }],
    ['opp', '商机跟进', { sales_mgr: 'r', sales: 'e' }],
    ['score', '销售组内对比与人效复核', { ceo: 'v', sales_mgr: 'r', sales: 'e' }],
    ['qc', '质检与交付批次', { prod_lead: 'e', qc: 'e' }],
    ['cap', '人力与算力 · 接单评估', { ceo: 'v', prod_lead: 'e', ai_lead: 'e' }],
    ['edu', '班次 · 转班 · 退费', { finance: 'e', edu_lead: 'v', teacher: 'e' }],
    ['ms', 'AI 服务里程碑', { finance: 'r', ai_lead: 'e', ceo: 'v' }],
    ['perm', '权限矩阵与协作授权', { admin: 'e', ceo: 'v', prod_lead: 'e' }],
    ['audit', '操作留痕', { admin: 'v', ceo: 'v' }],
  ];
  const can = (mod, lvl) => { const m = MODS.find((x) => x[0] === mod); const p = m && m[2][S.role]; return !!p && (!lvl || p === lvl || (lvl === 'v')); };

  // 字段级控制：没有权限的卡片显示遮罩
  const MASK = {
    sales: { 'c-sales-board': '具名排行需授权，本人可在工作台查看自己的分项', 'c-sales-rank': '具名排名需授权，本人可在工作台查看自己的分项', 'c-sales-radar': '组间对比仅主管可见', 'c-sales-actions': '同事的跟进明细仅主管可见', 'c-sales-gauge': '团队业绩目标仅主管可见' },
    prod_lead: { 'c-prod-cost': null },
    finance: {},
    admin: {},
  };

  // ---------- 初始演示数据 ----------
  const OWNER = { 悦颜美妆: '陈思远', 麦芒文化: '林可欣', 火山动漫: '孙浩然', 远舟律所: '陈思远', 星河影业: '刘一鸣', 橙光互娱: '林可欣', 华川医疗器械: '周晓彤', 通衡物流: '陈思远' };
  const CONTRACT = {
    悦颜美妆: ['HT-AI-2026-031', '数字人直播脚本系统', 790000], 麦芒文化: ['HT-MJ-2026-018', '《总裁的AI替身》制作合同', 960000],
    火山动漫: ['HT-MJ-2026-027', '《龙王赘婿·动画版》制作合同', 1650000], 远舟律所: ['HT-AI-2026-022', '合同审查助手', 420000],
    星河影业: ['HT-MJ-2026-011', '《重生之我在古代开奶茶店》S2', 1280000], 橙光互娱: ['HT-MJ-2026-015', '《修仙从送外卖开始》', 1450000],
    华川医疗器械: ['HT-AI-2026-009', '智能客服知识库定制', 680000], 通衡物流: ['HT-AI-2026-035', '工单智能分派系统', 550000],
  };
  function initState() {
    const inst = [];
    D.fin_receivables.forEach((r, i) => {
      const c = CONTRACT[r.customer];
      // 每份合同补一期已清分期，便于在详情里看到合同全貌
      inst.push({ id: 'AR' + (101 + i * 2), customer: r.customer, contract: c[0], cname: c[1], camount: c[2], business: r.business, period: '第1期', item: r.item.replace(/[^·]*$/, '') + '首付款', due: '2026-0' + (6 + (i % 3)) + '-15', amount: Math.round(r.amount * 0.8 / 1000) * 1000, paid: Math.round(r.amount * 0.8 / 1000) * 1000, owner: OWNER[r.customer], events: [{ t: '2026-0' + (6 + (i % 3)) + '-14', who: '财务·李会计', what: '核销到账，银行流水 BK' + (5200 + i) }] });
      inst.push({ id: 'AR' + (102 + i * 2), customer: r.customer, contract: c[0], cname: c[1], camount: c[2], business: r.business, period: '第2期', item: r.item, due: r.due_date, amount: r.amount, paid: 0, owner: OWNER[r.customer], events: [{ t: '2026-10-31', who: '系统', what: '应收形成（财务确认触发条件已满足）' }], promise: null });
    });
    // 远舟律所已部分到账，演示「部分核销」
    const yz = inst.find((x) => x.customer === '远舟律所' && x.period === '第2期'); yz.paid = 26000; yz.events.push({ t: '2026-10-30', who: '财务·李会计', what: '部分核销 ¥26,000，银行流水 BK5291' });
    const bank = [
      { id: 'BK6012', date: '2026-11-02', payer: '悦颜美妆（上海）科技有限公司', amount: 237000, memo: '直播脚本系统款', claimed: null },
      { id: 'BK6013', date: '2026-11-02', payer: '火山动漫文化传媒', amount: 495000, memo: '龙王赘婿首付', claimed: null },
      { id: 'BK6015', date: '2026-11-03', payer: '个人转账·王**', amount: 6980, memo: '学费', claimed: null },
    ];
    const segs = [];
    const proj = [['《重生之我在古代开奶茶店》S2', 'CS2', 'E11'], ['《修仙从送外卖开始》', 'XX', 'E07'], ['《千金归来》番外', 'QJ', 'E02']];
    const members = ['小林', '阿杰', '佳佳', '老顾'];
    let n = 0;
    proj.forEach(([p, code, ep]) => {
      for (let k = 1; k <= 4; k++) {
        n++;
        const st = n % 5 === 0 ? '退回' : n % 3 === 0 ? '通过' : '待质检';
        segs.push({ id: code + '-' + ep + '-' + String(k).padStart(2, '0'), project: p, ver: st === '退回' ? 1 : 1 + (n % 2), sec: 30 + (n * 7) % 40, by: members[n % 4], at: '2026-10-' + (28 + (n % 3)) + ' ' + (10 + n % 8) + ':20', status: st, reason: st === '退回' ? '口型与配音不同步' : '', history: [] });
      }
    });
    const batches = [{ id: 'PC-CS2-07', project: '《重生之我在古代开奶茶店》S2', segs: ['CS2-E10-01', 'CS2-E10-02', 'CS2-E10-03'], sec: 186, submitted: '2026-10-25', proof: '网盘交付单 JD-1025', signed: '2026-10-27', accepted: null }];
    const refunds = [
      { id: 'TF-1031-01', student: '刘**', klass: '杭州 · 漫剧剪辑 10 期', site: '杭州', amount: 6980, reason: '个人时间冲突', status: '待财务核对', paid: 0, by: '孙老师', at: '2026-10-30' },
      { id: 'TF-1029-02', student: '陈**', klass: '杭州 · AI 分镜 6 期', site: '杭州', amount: 4980, reason: '课程不符合预期', status: '已付', paid: 4980, by: '孙老师', at: '2026-10-29' },
    ];
    const roster = [
      { name: '王**', klass: '杭州 · 漫剧剪辑 10 期', status: '在读', moves: [] }, { name: '李**', klass: '杭州 · 漫剧剪辑 10 期', status: '在读', moves: [] },
      { name: '张**', klass: '杭州 · AI 分镜 6 期', status: '在读', moves: [] }, { name: '赵**', klass: '杭州 · AI 分镜 6 期', status: '结业', moves: [] },
      { name: '周**', klass: '杭州 · 漫剧剪辑 10 期', status: '在读', moves: [] },
    ];
    const opps = [
      { id: 'SJ-2101', customer: '悦颜美妆', name: '数字人二期·多语种', stage: '方案报价', amount: 360000, owner: '陈思远', last: '2026-10-29', next: '11-03 发送报价单', log: [] },
      { id: 'SJ-2107', customer: '通衡物流', name: '会议纪要助手增购', stage: '需求沟通', amount: 48000, owner: '陈思远', last: '2026-10-20', next: '', log: [] },
      { id: 'SJ-2113', customer: '远舟律所', name: '合同审查助手·运维', stage: '商务谈判', amount: 96000, owner: '陈思远', last: '2026-10-22', next: '', log: [] },
      { id: 'SJ-2120', customer: '恒拓机械', name: '设备手册机器人二期', stage: '初步接触', amount: 210000, owner: '刘一鸣', last: '2026-10-18', next: '', log: [] },
      { id: 'SJ-2122', customer: '蓝鲸教育', name: 'AI写作 SaaS 扩容', stage: '方案报价', amount: 76000, owner: '周晓彤', last: '2026-10-30', next: '11-05 演示', log: [] },
      { id: 'SJ-2125', customer: '鲜檬餐饮集团', name: '门店智能巡检', stage: '需求沟通', amount: 420000, owner: '王子涵', last: '2026-10-16', next: '', log: [] },
    ];
    const ms = D.ai_contracts.filter((a) => a.type === '定制项目').map((a) => {
      const st = { 需求确认: 0, 开发: 1, 测试: 2, 上线: 3, 售后运维: 4 }[a.stage] || 0;
      const had = inst.find((x) => x.customer === a.customer && x.period === '第2期' && x.item.includes(a.next_node));
      return { id: a.id, project: a.project, customer: a.customer, stage: a.stage, node: a.next_node, amount: a.next_node_amount, plan: a.plan_date, delay: a.delay_days, flags: { self: st >= 2, internal: st >= 3, sent: !!had, accepted: !!had }, triggered: !!had, inst: had ? had.id : null, log: had ? [{ t: '2026-10-31', who: '系统', what: '已关联应收分期 ' + had.id + '（' + had.item + '）' }] : [] };
    });
    const corrections = [{ id: 'GZ-01', rep: '周晓彤', item: '回款', field: 'collected', value: 640000, from: '520,000', to: '640,000', basis: '10/30 蓝鲸教育到账 12 万，流水 BK5288', status: '待复核', by: '周晓彤', at: '2026-10-31' }];
    const grants = [
      { id: 'SQ-01', who: '郑工（AI服务）', obj: 'HT-AI-2026-031 交付进度', act: '查看明细', reason: '联合交付数字人二期', approver: '', until: '2026-12-31', status: '待审批', by: '周导' },
      { id: 'SQ-00', who: '钱主管（培训）', obj: '杭州地点退费明细', act: '查看明细', reason: '退费复盘', approver: '系统管理员', until: '2026-11-15', status: '生效中', by: '钱主管' },
    ];
    return { v: 2, role: 'ceo', clock: Date.UTC(2026, 10, 3, 1, 30), inst, bank, segs, batches, refunds, roster, opps, ms, corrections, grants, risk: {}, audit: [] };
  }

  let S;
  try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
  if (!S || S.v !== 2) S = initState();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const now = () => { S.clock += 7 * 60000; const d = new Date(S.clock + 8 * 3600000); return d.toISOString().slice(0, 16).replace('T', ' '); };
  const me = () => ROLES[S.role].name + '·' + ROLES[S.role].who.replace(/（.*/, '');
  function audit(obj, act, before, after, basis) { S.audit.unshift({ t: now(), who: me(), obj, act, before: before == null ? '' : String(before), after: after == null ? '' : String(after), basis: basis || '' }); }

  // ---------- 把工作流结果写回经营数据，驱动看板重算 ----------
  const FC = Array.isArray(D.fin_cash) ? D.fin_cash[0] : D.fin_cash;
  const BASE = { recv: FC.receivable, recvMonth: FC.received_month, cash: FC.cash_balance };
  const baseAR = clone(D.fin_receivables);
  function sync() {
    const open = S.inst;
    D.fin_receivables = baseAR.map((r) => {
      const x = S.inst.find((i) => i.customer === r.customer && i.period === '第2期');
      return Object.assign({}, r, { amount: x.amount - x.paid });
    }).filter((r) => r.amount > 0);
    S.inst.filter((x) => x.extra && x.amount > x.paid).forEach((x) => D.fin_receivables.push({ customer: x.customer, business: x.business, item: x.item, amount: x.amount - x.paid, due_date: x.due, overdue_days: 0 }));
    const base2 = baseAR.reduce((a, r) => a + r.amount, 0);
    const nowAR = open.filter((x) => x.period === '第2期' || x.extra).reduce((s, x) => s + x.amount - x.paid, 0);
    FC.receivable = BASE.recv - (base2 - nowAR);
    const extraPaid = S.inst.reduce((s, x) => s + (x.paidNew || 0), 0);
    FC.received_month = BASE.recvMonth + extraPaid;
    FC.cash_balance = BASE.cash + extraPaid;
  }
  function commit() { save(); sync(); window.__dashRefresh(); render(); }

  // ---------- 风险：在系统预警基础上叠加处置状态 ----------
  const riskKey = (r) => r.type + '|' + r.item;
  const AREA_OWNER = { 财务: 'finance', 招生: 'edu_lead', 制作: 'prod_lead', 'AI服务': 'ai_lead', 销售: 'sales_mgr', 资源: 'ceo' };
  function risks() {
    const live = (window.dash.data('alerts').data || []);
    const out = live.map((r) => Object.assign({ live: true }, r, { key: riskKey(r) }));
    // 已清偿的应收不再触发，但处置记录要保留到复核关闭
    Object.keys(S.risk).forEach((k) => { if (!out.some((r) => r.key === k) && S.risk[k].snap) out.push(Object.assign({ live: false }, S.risk[k].snap, { key: k })); });
    out.forEach((r) => {
      if (!S.risk[r.key]) {
        const ar = r.type === '应收款逾期' ? S.inst.find((x) => r.item === x.customer + '·' + x.item) : null;
        S.risk[r.key] = ar ? { status: '处理中', owner: '销售·' + ar.owner, next: '联系客户确认付款安排', log: [{ t: '2026-10-31', who: '系统', what: '规则命中，按合同归属自动分派给销售·' + ar.owner }] } : { status: '待分派', owner: '', next: '', log: [{ t: '2026-10-31', who: '系统', what: '规则命中：' + r.detail }] };
      }
      S.risk[r.key].snap = { level: r.level, area: r.area, type: r.type, item: r.item, detail: r.detail };
      r.st = S.risk[r.key];
    });
    return out;
  }
  function riskVisible(r) {
    if (S.role === 'ceo') return true;
    if (S.role === 'finance') return r.area === '财务';
    if (S.role === 'sales') { const ar = arOf(r); return !!ar && ar.owner === '陈思远'; }
    return AREA_OWNER[r.area] === S.role;
  }
  const arOf = (r) => (r.type === '应收款逾期' ? S.inst.find((x) => r.item === x.customer + '·' + x.item) : null);

  // ---------- 外壳：岗位切换、工作台页签、抽屉 ----------
  const root = document.querySelector('.bz');
  const head = document.querySelector('.bz-chips');
  const roleSel = h('select.wf-role', { 'aria-label': '切换岗位账号', onchange: (e) => { S.role = e.target.value; save(); applyRole(true); } },
    ROLE_ORDER.map((k) => h('option', { value: k }, ROLES[k].name + ' · ' + ROLES[k].who)));
  const todoBtn = h('button.bz-chip.wf-todo', { type: 'button', onclick: () => { window.__openTab('wb'); setTimeout(() => document.getElementById('wf-m-todo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); } }, '我的待办 ', h('b', '0'));
  const resetBtn = h('button.bz-chip.wf-reset', { type: 'button', title: '恢复演示数据初始状态', onclick: () => { if (confirmReset()) { localStorage.removeItem(KEY); location.reload(); } } }, '重置演示');
  function confirmReset() { return true; }
  head.prepend(h('label.bz-chip.wf-rolechip', h('span.wf-rl', '当前账号'), roleSel), todoBtn);
  head.append(resetBtn);

  const tabs = document.querySelector('.bz-tabs');
  const wbBtn = h('button.bz-tab', { role: 'tab', 'data-tab': 'wb', 'aria-selected': 'false', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11l3 3 8-8M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9"/></svg>我的工作台' });
  tabs.insertBefore(wbBtn, tabs.children[1]);
  const frame = document.querySelector('.bz-frame');
  const wb = h('section.bz-sec', { id: 'wb', hidden: true });
  frame.insertBefore(wb, frame.children[1]);
  const roleBar = h('div.wf-scope');
  document.querySelector('.bz-head').insertBefore(roleBar, document.querySelector('.bz-tabs'));

  // 抽屉
  const shade = h('div.wf-shade', { hidden: true, onclick: (e) => { if (e.target === shade) closeDrawer(); } });
  const drawer = h('aside.wf-drawer', { role: 'dialog', 'aria-modal': 'true' });
  shade.append(drawer); root.append(shade);
  let drawerFn = null;
  function openDrawer(fn) { drawerFn = fn; paintDrawer(); shade.hidden = false; document.body.style.overflow = 'hidden'; }
  function paintDrawer() { if (!drawerFn) return; const [title, sub, body] = drawerFn(); drawer.replaceChildren(h('div.wf-dh', h('div', h('h3', title), sub ? h('div.wf-dsub', sub) : null), h('button.wf-x', { type: 'button', 'aria-label': '关闭', onclick: closeDrawer }, '×')), h('div.wf-db', body)); }
  function closeDrawer() { shade.hidden = true; drawerFn = null; document.body.style.overflow = ''; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !shade.hidden) closeDrawer(); });
  function toast(msg) { const t = h('div.wf-toast', msg); root.append(t); setTimeout(() => t.classList.add('on'), 10); setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 300); }, 2600); }

  // 表单小组件
  const field = (label, input) => h('label.wf-f', h('span', label), input);
  const inp = (attrs) => h('input', Object.assign({ type: 'text' }, attrs));
  const sel = (opts, attrs) => h('select', attrs || {}, opts.map((o) => (Array.isArray(o) ? h('option', { value: o[0] }, o[1]) : h('option', { value: o }, o))));
  const btn = (t, fn, kind) => h('button.wf-btn' + (kind ? '.' + kind : ''), { type: 'button', onclick: fn }, t);
  const kv = (rows) => h('dl.wf-kv', rows.map(([k, v]) => [h('dt', k), h('dd', v)]));
  const timeline = (evs) => h('ol.wf-tl', evs.slice().reverse().map((e) => h('li', h('time', e.t), h('b', e.who), h('span', e.what))));
  const lock = (msg) => h('div.wf-lock', h('span', '🔒'), msg);
  const card = (id, span, title, sub, body, right) => h('div.bz-card.' + span, { id: 'wf-m-' + id }, h('div.bz-card-h', h('h3', title, sub ? h('span.sub', sub) : null), right || null), body);

  // ---------- 应收分期详情（R01/R11 首条评审用例） ----------
  function arDrawer(id) {
    return () => {
      const x = S.inst.find((i) => i.id === id);
      const bal = x.amount - x.paid;
      const overdue = Math.max(0, Math.round((Date.UTC(2026, 9, 31) - Date.parse(x.due)) / 864e5));
      const st = bal <= 0 ? pill('已清', 'ok') : x.paid > 0 ? pill('部分到账', 'warn') : overdue > 0 ? pill('逾期 ' + overdue + ' 天', 'bad') : pill('未到期', 'teal');
      const mine = S.role === 'sales' && x.owner === '陈思远';
      const seeDetail = ['ceo', 'finance', 'sales_mgr', 'ai_lead'].includes(S.role) || mine;
      if (!seeDetail) return [x.customer, '无权查看', lock('该客户不在你的授权范围内。可见汇总值：应收余额 ' + yuan(bal) + '。如需协作，请由合同负责人发起协作授权。')];
      const siblings = S.inst.filter((i) => i.contract === x.contract);
      const body = [
        h('div.wf-hero', h('div', h('span', '未清余额'), h('b', yuan(bal))), h('div', h('span', '本期应收'), h('b.s', yuan(x.amount))), h('div', h('span', '已核销'), h('b.s', yuan(x.paid))), st),
        kv([['客户', x.customer], ['合同', x.contract + ' · ' + x.cname], ['合同总额', yuan(x.camount)], ['分期', x.period + ' · ' + x.item], ['到期日', x.due], ['跟进责任人', '销售·' + x.owner], ['数据来源', '财务分期核销明细 · 截至 2026-10-31 · 口径 v0.2']]),
        x.promise ? h('div.wf-note', '客户付款答复：', h('b', x.promise.type), '，承诺 ', h('b', x.promise.date), ' 支付 ', h('b', yuan(x.promise.amount)), x.promise.memo ? '（' + x.promise.memo + '）' : '', h('small', '付款承诺单列，不计入已核销')) : null,
        h('h4', '同合同分期'),
        h('table.wf-mini', h('thead', h('tr', ['分期', '到期日', '应收', '已核销', '余额'].map((t) => h('th', t)))), h('tbody', siblings.map((s) => h('tr', { class: s.id === x.id ? 'on' : '' }, h('td', s.period), h('td', s.due), h('td.num', nf(s.amount)), h('td.num', nf(s.paid)), h('td.num', nf(s.amount - s.paid)))))),
      ];
      // 动作：销售登记付款答复；财务认领到账并核销
      if (bal > 0 && mine) {
        const t = sel(['承诺付款', '申请延期', '对金额有异议']), d = inp({ type: 'date', value: '2026-11-10' }), a = inp({ type: 'number', value: bal }), m = inp({ placeholder: '如：对方财务已走付款审批' });
        body.push(h('h4', '登记客户付款答复'), h('div.wf-form', field('答复类型', t), field('承诺日期', d), field('承诺金额', a), field('说明', m), btn('提交答复', () => {
          x.promise = { type: t.value, date: d.value, amount: +a.value, memo: m.value };
          x.events.push({ t: now(), who: me(), what: '登记付款答复：' + t.value + '，' + d.value + ' 付 ' + yuan(+a.value) + (m.value ? '（' + m.value + '）' : '') });
          const rk = Object.keys(S.risk).find((k) => k.endsWith(x.customer + '·' + x.item));
          if (rk) { S.risk[rk].next = '等待到账：' + d.value; S.risk[rk].log.push({ t: now(), who: me(), what: '记录下一动作：客户' + t.value + '，' + d.value }); }
          audit(x.contract + ' ' + x.period, '登记付款答复', '', t.value + ' ' + d.value + ' ' + yuan(+a.value), m.value);
          commit(); toast('已登记付款答复，财务会在到账后核销');
        }, 'pri')));
      }
      if (bal > 0 && S.role === 'finance') {
        const avail = (b) => b.amount - (b.used || 0);
        const cands = S.bank.filter((b) => avail(b) > 0);
        const bs = sel(cands.map((b) => [b.id, b.id + ' · ' + b.date + ' · ' + b.payer + ' · 可用 ' + yuan(avail(b))]));
        const a = inp({ type: 'number', value: Math.min(bal, cands[0] ? avail(cands[0]) : bal) });
        bs.addEventListener('change', () => { const b = S.bank.find((z) => z.id === bs.value); a.value = Math.min(bal, avail(b)); });
        body.push(h('h4', '认领到账并核销'), cands.length ? h('div.wf-form', field('银行流水（待认领）', bs), field('核销金额', a), btn('确认核销', () => {
          const b = S.bank.find((z) => z.id === bs.value); const v = Math.min(+a.value, bal, avail(b));
          if (!(v > 0)) return toast('核销金额需大于 0');
          const before = bal;
          x.paid += v; x.paidNew = (x.paidNew || 0) + v; b.used = (b.used || 0) + v; (b.alloc = b.alloc || []).push({ inst: x.id, amount: v });
          x.events.push({ t: now(), who: me(), what: '核销 ' + yuan(v) + '，银行流水 ' + b.id + '，余额 ' + yuan(x.amount - x.paid) });
          audit(x.contract + ' ' + x.period, '核销到账', '余额 ' + nf(before), '余额 ' + nf(x.amount - x.paid), '流水 ' + b.id);
          const rk = Object.keys(S.risk).find((k) => k.endsWith(x.customer + '·' + x.item));
          if (rk) {
            const r = S.risk[rk];
            if (x.amount - x.paid <= 0) { r.status = '待复核'; r.evidence = '财务核销完毕，流水 ' + b.id; r.log.push({ t: now(), who: me(), what: '余额已清，提交复核关闭（证据：流水 ' + b.id + '）' }); }
            else r.log.push({ t: now(), who: me(), what: '部分核销 ' + yuan(v) + '，余额 ' + yuan(x.amount - x.paid) });
          }
          commit(); toast('核销成功，经营首页应收余额已更新');
        }, 'pri')) : h('div.wf-note', '暂无待认领到账'));
      }
      if (bal > 0 && !mine && S.role !== 'finance') body.push(h('div.wf-note.muted', S.role === 'ceo' ? 'CEO 视图只读：可看到处置进度；付款答复由销售登记，到账由财务核销。' : '只读'));
      body.push(h('h4', '处理记录'), timeline(x.events));
      return [x.customer + ' · ' + x.period, x.contract + ' · ' + x.business, body];
    };
  }

  // ---------- 风险详情（R03） ----------
  function riskDrawer(key) {
    return () => {
      const r = risks().find((z) => z.key === key);
      if (!r) return ['风险', '', h('div', '已不存在')];
      const st = r.st, ar = arOf(r);
      const ownerRole = AREA_OWNER[r.area];
      const isOwner = (S.role === ownerRole) || (ar && S.role === 'sales' && ar.owner === '陈思远') || (r.area === '财务' && S.role === 'finance');
      const body = [
        h('div.wf-hero', h('div', h('span', '触发'), h('b.s', r.detail)), pill(r.level === '高' ? '高风险' : '关注', r.level === '高' ? 'bad' : 'warn'), statusPill(st.status)),
        kv([['规则', r.type], ['对象', r.item], ['板块', r.area], ['首接岗位', ROLES[ownerRole] ? ROLES[ownerRole].name : '—'], ['责任人', st.owner || '未分派'], ['下一动作', st.next || '—'], ['复核人', 'CEO'], ['触发时间 / 来源', '2026-10-31 · 规则引擎（阈值见综合看板「预警规则」）']]),
        ar ? h('button.wf-link', { type: 'button', onclick: () => openDrawer(arDrawer(ar.id)) }, '查看关联应收分期 →') : null,
      ];
      const f = h('div.wf-form');
      if (st.status === '待分派' && (S.role === 'ceo' || S.role === ownerRole)) {
        const who = sel(['负责人·' + (ROLES[ownerRole] || ROLES.ceo).who, '财务·李会计', '销售主管·王经理', '制作负责人·周导', '培训负责人·钱主管', 'AI服务负责人·郑工']);
        const nx = inp({ placeholder: '如：3 天内给出原因和整改方案' });
        f.append(field('分派给', who), field('下一动作', nx), btn('分派', () => { st.status = '处理中'; st.owner = who.value; st.next = nx.value || '核实原因'; st.log.push({ t: now(), who: me(), what: '分派给 ' + who.value + '：' + st.next }); audit(r.item, '分派风险', '待分派', '处理中 · ' + who.value); commit(); }, 'pri'));
      } else if (st.status === '处理中' && isOwner) {
        const nx = inp({ placeholder: '本次处理 / 下一动作' }), ev = inp({ placeholder: '证据：合同、流水号、改期批准单等' });
        f.append(field('处理说明', nx), field('关闭证据', ev), btn('记录进展', () => { if (!nx.value) return toast('请填写处理说明'); st.next = nx.value; st.log.push({ t: now(), who: me(), what: '记录进展：' + nx.value }); commit(); }), btn('提交复核', () => { if (!ev.value) return toast('提交复核需附关闭证据'); st.status = '待复核'; st.evidence = ev.value; st.log.push({ t: now(), who: me(), what: '提交复核，证据：' + ev.value }); audit(r.item, '提交风险复核', '处理中', '待复核', ev.value); commit(); }, 'pri'));
      } else if (st.status === '待复核' && S.role === 'ceo') {
        f.append(h('div.wf-note', '关闭证据：', h('b', st.evidence || '—'), r.live ? h('small', '注意：该规则仍在命中，关闭后若再次命中将关联本条记录重新打开') : h('small', '规则已不再命中')),
          btn('复核通过并关闭', () => { st.status = '已关闭'; st.log.push({ t: now(), who: me(), what: '复核通过，关闭' }); audit(r.item, '复核关闭风险', '待复核', '已关闭', st.evidence); commit(); }, 'pri'),
          btn('退回', () => { st.status = '处理中'; st.log.push({ t: now(), who: me(), what: '复核退回：证据不足' }); audit(r.item, '退回风险', '待复核', '处理中'); commit(); }));
      } else if (st.status === '已关闭' && r.live && S.role === 'ceo') {
        f.append(h('div.wf-note', '该对象再次命中规则。', btn('重新打开', () => { st.status = '处理中'; st.log.push({ t: now(), who: me(), what: '再次命中，关联上次处理记录重新打开' }); commit(); })));
      }
      if (f.children.length) body.push(h('h4', '处置'), f);
      body.push(h('h4', '处置记录'), timeline(st.log));
      return [r.type, r.item, body];
    };
  }
  function statusPill(s) { return pill(s, { 待分派: 'bad', 处理中: 'warn', 待复核: 'sky', 已关闭: 'ok' }[s] || 'teal'); }

  // ---------- 工作台模块 ----------
  function todos() {
    const out = [];
    const add = (txt, kind, go) => out.push({ txt, kind, go });
    const R = S.role;
    risks().filter(riskVisible).forEach((r) => {
      const st = r.st;
      if (st.status === '待分派' && AREA_OWNER[r.area] === R) add('分派风险：' + r.type + ' · ' + r.item, '分派', () => openDrawer(riskDrawer(r.key)));
      else if (st.status === '处理中' && R !== 'ceo' && (AREA_OWNER[r.area] === R || (arOf(r) && R === 'sales'))) add('处理风险：' + r.type + ' · ' + r.item, '处理', () => openDrawer(riskDrawer(r.key)));
      else if (st.status === '待复核' && R === 'ceo') add('复核关闭：' + r.type + ' · ' + r.item, '复核', () => openDrawer(riskDrawer(r.key)));
    });
    if (R === 'sales') {
      S.inst.filter((x) => x.owner === '陈思远' && x.amount > x.paid && x.due < '2026-11-01' && !x.promise).forEach((x) => add('逾期应收需登记客户答复：' + x.customer + ' ' + x.period + ' ' + yuan(x.amount - x.paid), '答复', () => openDrawer(arDrawer(x.id))));
      S.opps.filter((o) => o.owner === '陈思远' && !o.lost && o.last < '2026-10-25').forEach((o) => add('商机超 7 天未跟进：' + o.customer + ' · ' + o.name, '跟进', () => openDrawer(oppDrawer(o.id))));
    }
    if (R === 'finance') {
      S.bank.filter((b) => b.amount > (b.used || 0)).forEach((b) => add('到账待认领：' + b.id + ' ' + b.payer + ' 可用 ' + yuan(b.amount - (b.used || 0)), '认领', () => openDrawer(bankDrawer(b.id))));
      S.refunds.filter((f) => f.status === '待财务核对' || f.status === '部分实付').forEach((f) => add((f.status === '部分实付' ? '退费待补付：' : '退费待核对：') + f.student + ' ' + f.klass + ' ' + yuan(f.amount - f.paid), '核对', () => openDrawer(refundDrawer(f.id))));
      S.ms.filter((m) => m.flags.accepted && !m.triggered).forEach((m) => add('里程碑已验收，确认转应收：' + m.customer + ' · ' + m.node, '复核', () => openDrawer(msDrawer(m.id))));
    }
    if (R === 'qc') S.segs.filter((s) => s.status === '待质检').forEach((s) => add('待质检：' + s.id + ' v' + s.ver + ' · ' + s.sec + ' 秒', '质检', () => openDrawer(segDrawer(s.id))));
    if (R === 'prod_lead') {
      const ok = S.segs.filter((s) => s.status === '通过' && !s.batch).length; if (ok) add(ok + ' 个通过片段可组成交付批次', '组批', () => document.getElementById('wf-m-qc')?.scrollIntoView({ behavior: 'smooth' }));
      S.segs.filter((s) => s.status === '退回').forEach((s) => add('返修后重新提交：' + s.id + '（' + s.reason + '）', '返修', () => openDrawer(segDrawer(s.id))));
      S.grants.filter((g) => g.status === '已驳回' && g.by === '周导').forEach((g) => add('协作授权被驳回：' + g.obj, '查看', () => {}));
    }
    if (R === 'teacher') S.refunds.filter((f) => f.status === '部分实付').forEach((f) => add('退费部分实付，需告知学员：' + f.student, '告知', () => openDrawer(refundDrawer(f.id))));
    if (R === 'ai_lead') S.ms.filter((m) => !m.flags.accepted && m.flags.self).forEach((m) => add('里程碑待推进：' + m.customer + ' · ' + m.project, '推进', () => openDrawer(msDrawer(m.id))));
    if (R === 'sales_mgr') {
      S.corrections.filter((c) => c.status === '待复核').forEach((c) => add('人效更正待复核：' + c.rep + ' · ' + c.item, '复核', () => openDrawer(corrDrawer(c.id))));
      S.opps.filter((o) => !o.lost && o.last < '2026-10-25').forEach((o) => add('组内超时未跟进：' + o.owner + ' · ' + o.customer, '督办', () => openDrawer(oppDrawer(o.id))));
    }
    if (R === 'admin') S.grants.filter((g) => g.status === '待审批').forEach((g) => add('协作授权待审批：' + g.who + ' → ' + g.obj, '审批', () => openDrawer(grantDrawer(g.id))));
    const pr = { 复核: 0, 核对: 1, 认领: 2, 答复: 1, 质检: 1 };
    return out.sort((a, b) => (pr[a.kind] ?? 5) - (pr[b.kind] ?? 5));
  }

  function modTodo() {
    const t = todos();
    return card('todo', 's4', '我的待办', t.length + ' 项', t.length ? h('ul.wf-todos', t.slice(0, 12).map((x) => h('li', { onclick: x.go, tabindex: 0, onkeydown: (e) => { if (e.key === 'Enter') x.go(); } }, h('span.wf-tk', x.kind), h('span', x.txt)))) : h('div.bz-empty', '没有待办，干得漂亮'));
  }

  function modAR() {
    const mine = S.role === 'sales';
    let rows = S.inst.filter((x) => x.period === '第2期' || x.extra);
    if (mine) rows = rows.filter((x) => x.owner === '陈思远');
    const f = S.arFilter || '';
    if (f) rows = rows.filter((x) => x.business === f);
    const seg = h('div.bz-seg', ['', '漫剧制作', '企业AI服务'].map((b) => h('button', { class: f === b ? 'on' : '', onclick: () => { S.arFilter = b; save(); render(); } }, b || '全部')));
    const tot = rows.reduce((s, x) => s + x.amount - x.paid, 0);
    const od = rows.filter((x) => x.amount > x.paid && x.due < '2026-11-01').reduce((s, x) => s + x.amount - x.paid, 0);
    const tb = h('tbody', rows.map((x) => {
      const bal = x.amount - x.paid;
      const st = bal <= 0 ? pill('已清', 'ok') : x.paid > 0 ? pill('部分到账', 'warn') : x.due < '2026-11-01' ? pill('逾期', 'bad') : pill('未到期', 'teal');
      return h('tr.wf-click', { onclick: () => openDrawer(arDrawer(x.id)), tabindex: 0, onkeydown: (e) => { if (e.key === 'Enter') openDrawer(arDrawer(x.id)); } },
        h('td.bz-strong', x.customer), h('td', x.contract), h('td', x.period + ' · ' + x.item.replace(/.*·/, '')), h('td', x.due), h('td.num', nf(x.amount)), h('td.num', nf(x.paid)), h('td.num.bz-strong', nf(bal)), h('td', x.owner), h('td', st, x.promise ? h('span.wf-tag', '已答复') : null));
    }));
    return card('ar', 's8', '应收分期与核销', (mine ? '仅本人客户 · ' : '') + '未清 ' + yuan(tot) + ' · 逾期 ' + yuan(od), h('div.bz-tw', h('table', h('thead', h('tr', ['客户', '合同', '分期', '到期日', '应收', '已核销', '余额', '责任人', '状态'].map((t, i) => h('th', { class: i >= 4 && i <= 6 ? 'num' : '' }, t)))), tb)), seg);
  }

  function modRisk() {
    const rs = risks().filter(riskVisible);
    const order = { 待分派: 0, 处理中: 1, 待复核: 2, 已关闭: 3 };
    rs.sort((a, b) => order[a.st.status] - order[b.st.status] || (a.level === '高' ? -1 : 1));
    const cnt = (s) => rs.filter((r) => r.st.status === s).length;
    return card('risk', 's12', '风险处置', '待分派 ' + cnt('待分派') + ' · 处理中 ' + cnt('处理中') + ' · 待复核 ' + cnt('待复核') + ' · 已关闭 ' + cnt('已关闭'),
      h('div.bz-tw.tall', h('table', h('thead', h('tr', ['等级', '板块', '类型', '对象', '触发值', '责任人', '下一动作', '状态'].map((t) => h('th', t)))),
        h('tbody', rs.map((r) => h('tr.wf-click', { onclick: () => openDrawer(riskDrawer(r.key)) }, h('td', pill(r.level === '高' ? '高风险' : '关注', r.level === '高' ? 'bad' : 'warn')), h('td', r.area), h('td.bz-strong', r.type), h('td', r.item), h('td.bz-muted', r.detail), h('td', r.st.owner || '—'), h('td.bz-muted', r.st.next || '—'), h('td', statusPill(r.st.status))))))));
  }

  // 商机跟进（R10/R11）
  function oppDrawer(id) {
    return () => {
      const o = S.opps.find((z) => z.id === id);
      const mine = o.owner === '陈思远' && S.role === 'sales';
      const body = [kv([['客户', o.customer], ['商机', o.name], ['阶段', o.stage], ['预计金额', yuan(o.amount)], ['责任人', o.owner], ['上次有效跟进', o.last], ['下次动作', o.next || '—'], ['状态', o.lost ? '已丢单：' + o.lost : '进行中']])];
      const ar = S.inst.filter((x) => x.customer === o.customer && (x.period === '第2期' || x.extra));
      if (ar.length) body.push(h('h4', '关联合同收款进度'), h('table.wf-mini', h('tbody', ar.map((x) => h('tr', h('td', x.contract + ' ' + x.period), h('td', '到期 ' + x.due), h('td.num', '已收 ' + nf(x.paid)), h('td.num', '未清 ' + nf(x.amount - x.paid)))))));
      if (mine && !o.lost) {
        const way = sel(['电话', '上门拜访', '微信', '视频会议']), at = inp({ type: 'datetime-local', value: '2026-11-03T10:00' }), res = inp({ placeholder: '联系结果' }), nx = inp({ placeholder: '下次动作' }), nd = inp({ type: 'date', value: '2026-11-07' });
        body.push(h('h4', '记录跟进'), h('div.wf-form', field('方式', way), field('实际发生时间', at), field('联系结果', res), field('下次动作', nx), field('下次日期', nd), btn('保存跟进', () => {
          if (!res.value) return toast('请填写联系结果');
          const sig = way.value + at.value + res.value;
          if (o.log.some((l) => l.sig === sig)) return toast('同一条跟进已保存过，未重复生成');
          o.log.push({ t: now(), who: me(), what: way.value + '（实际 ' + at.value.replace('T', ' ') + '）：' + res.value + (nx.value ? '；下次：' + nd.value + ' ' + nx.value : ''), sig });
          o.last = at.value.slice(0, 10); o.next = nx.value ? nd.value.slice(5) + ' ' + nx.value : o.next;
          audit(o.id, '记录跟进', '', way.value + ' ' + res.value); commit();
        }, 'pri')));
        const why = sel(['预算不足/延期', '选择竞品', '需求变化', '价格过高', '决策人变更']);
        body.push(h('h4', '丢单'), h('div.wf-form', field('丢单原因（必填）', why), btn('标记丢单', () => { o.lost = why.value; o.log.push({ t: now(), who: me(), what: '标记丢单：' + why.value + '，移出活跃待办' }); audit(o.id, '标记丢单', o.stage, '丢单·' + why.value); commit(); }, 'danger')));
      }
      if (S.role === 'sales_mgr' && !o.lost) {
        const to = sel(['陈思远', '刘一鸣', '周晓彤', '王子涵', '赵雨辰']);
        body.push(h('h4', '主管督办 / 转派'), h('div.wf-form', field('转派给', to), btn('转派（保留历史归属）', () => { const f = o.owner; o.owner = to.value; o.log.push({ t: now(), who: me(), what: '转派：' + f + ' → ' + to.value }); audit(o.id, '转派商机', f, to.value); commit(); })));
      }
      body.push(h('h4', '跟进记录'), o.log.length ? timeline(o.log) : h('div.bz-empty', '暂无记录'));
      return [o.customer + ' · ' + o.name, o.id, body];
    };
  }
  function modOpp() {
    let rows = S.opps; if (S.role === 'sales') rows = rows.filter((o) => o.owner === '陈思远');
    return card('opp', 's8', '商机跟进', S.role === 'sales' ? '本人商机 · 超 7 天未跟进标红' : '一组全部商机', h('div.bz-tw', h('table', h('thead', h('tr', ['商机', '客户', '阶段', '金额', '责任人', '上次跟进', '下次动作', '状态'].map((t) => h('th', t)))),
      h('tbody', rows.map((o) => { const stale = !o.lost && o.last < '2026-10-25'; return h('tr.wf-click', { onclick: () => openDrawer(oppDrawer(o.id)) }, h('td.bz-strong', o.name), h('td', o.customer), h('td', o.stage), h('td.num', nf(o.amount)), h('td', o.owner), h('td', { class: stale ? 'att-miss' : '' }, o.last), h('td.bz-muted', o.next || '—'), h('td', o.lost ? pill('丢单', 'bad') : stale ? pill('超时', 'warn') : pill('跟进中', 'ok'))); })))));
  }

  // 销售组内对比与人效复核（R12）
  const W = [['业绩达成', 0.4], ['回款率', 0.2], ['跟进强度', 0.2], ['商机转化', 0.2]];
  function scoreRows() {
    const reps = D.sales_reps.filter((r) => r.group === '一组');
    const fix = {}; S.corrections.filter((c) => c.status === '已通过' && c.field).forEach((c) => { (fix[c.rep] = fix[c.rep] || {})[c.field] = c.value; });
    const val = (r, k) => (fix[r.rep] && fix[r.rep][k] != null ? +fix[r.rep][k] : +r[k]);
    const mx = (k) => Math.max(...reps.map((r) => val(r, k)));
    return reps.map((r) => {
      const won = val(r, 'won_amount'), att = won / +r.target;
      const p = [Math.min(1.2, att) / 1.2, Math.min(1, val(r, 'collected') / won), (val(r, 'calls') + r.visits * 10) / (mx('calls') + mx('visits') * 10), (r.opps / r.valid_leads) / Math.max(...reps.map((z) => z.opps / z.valid_leads))];
      const total = Math.round(p.reduce((s, v, i) => s + v * W[i][1], 0) * 1000) / 10;
      return { rep: r.rep, parts: p.map((v) => Math.round(v * 1000) / 10), total, n: r.opps, pend: S.corrections.some((c) => c.rep === r.rep && c.status === '待复核') };
    }).sort((a, b) => b.total - a.total);
  }
  function corrDrawer(id) {
    return () => {
      const c = S.corrections.find((z) => z.id === id);
      const body = [kv([['销售', c.rep], ['更正分项', c.item], ['原值', c.from], ['申请值', c.to], ['依据', c.basis], ['提交', c.by + ' · ' + c.at], ['状态', c.status]])];
      if (c.status === '待复核' && S.role === 'sales_mgr') {
        const before = scoreRows().find((r) => r.rep === c.rep).total;
        body.push(h('div.wf-form', btn('核实通过并重算', () => { c.status = '已通过'; const after = scoreRows().find((r) => r.rep === c.rep).total; c.result = '综合分 ' + before + ' → ' + after; audit('人效 ' + c.rep, '复核更正', before, after, c.basis); commit(); toast('已重算：' + c.result); }, 'pri'),
          btn('驳回', () => { c.status = '已驳回'; audit('人效 ' + c.rep, '驳回更正', c.from, c.from, '依据不足'); commit(); }, 'danger')));
      }
      if (c.result) body.push(h('div.wf-note', '重算结果：', h('b', c.result)));
      return ['人效更正 · ' + c.rep, c.id, body];
    };
  }
  function modScore() {
    const rows = scoreRows();
    const self = S.role === 'sales';
    const vis = self ? rows.filter((r) => r.rep === '陈思远') : rows;
    const body = [h('div.bz-tw', h('table', h('thead', h('tr', [self ? '本人' : '销售', ...W.map(([k, w]) => k + ' ' + w * 100 + '%'), '样本(商机)', '综合分', self ? '' : '组内排序', ''].filter((x) => x !== '').map((t) => h('th', t)))),
      h('tbody', vis.map((r) => h('tr', h('td.bz-strong', r.rep), r.parts.map((p) => h('td.num', p.toFixed(1))), h('td.num', r.n), h('td.num.bz-strong', r.total.toFixed(1)), self ? null : h('td.num', rows.indexOf(r) + 1), h('td', r.pend ? pill('更正待复核', 'sky') : r.n < 12 ? pill('样本不足·待复核', 'warn') : ''))))))];
    body.push(h('p.bz-fine', '规则版本 v0.3（示例，待客户书面确认）· 排名只用于辅助判断，不触发任何自动人事处置；具名排序、导出、人员处置分别授权。'));
    if (self) {
      const FIELDS = { 回款: 'collected', 成交额: 'won_amount', 跟进次数: 'calls' };
      const item = sel(Object.keys(FIELDS)), to = inp({ type: 'number', placeholder: '应为多少（元 / 次）' }), basis = inp({ placeholder: '依据：合同号、流水号' });
      body.push(h('div.wf-form.inline', field('更正分项', item), field('申请值', to), field('依据', basis), btn('提交更正', () => { if (!basis.value) return toast('请附依据'); if (!(+to.value > 0)) return toast('请填写申请值'); const fk = FIELDS[item.value], cur = D.sales_reps.find((r) => r.rep === '陈思远')[fk]; S.corrections.unshift({ id: 'GZ-' + (S.corrections.length + 1).toString().padStart(2, '0'), rep: '陈思远', item: item.value, field: fk, value: +to.value, from: nf(cur), to: nf(+to.value), basis: basis.value, status: '待复核', by: '陈思远', at: now().slice(0, 10) }); audit('人效 陈思远', '提交更正', '', item.value + ' ' + to.value, basis.value); commit(); toast('已提交主管复核'); }, 'pri')));
    }
    const cs = S.corrections.filter((c) => !self || c.rep === '陈思远');
    if (cs.length) body.push(h('h4.wf-h4', '更正记录'), h('ul.wf-todos', cs.map((c) => h('li', { onclick: () => openDrawer(corrDrawer(c.id)) }, h('span.wf-tk', c.status), h('span', c.rep + ' · ' + c.item + '：' + c.from + ' → ' + c.to + (c.result ? '（' + c.result + '）' : ''))))));
    return card('score', self ? 's4' : 's12', self ? '我的人效分项' : '一组组内对比与人效复核', self ? '仅本人可见' : '分项 · 权重 · 样本量', body);
  }

  // 质检与交付批次（R06/R07）
  function segDrawer(id) {
    return () => {
      const s = S.segs.find((z) => z.id === id);
      const body = [kv([['片段', s.id], ['项目', s.project], ['版本', 'v' + s.ver], ['有效秒数', s.sec + ' 秒'], ['提交人', s.by + ' · ' + s.at], ['状态', s.status + (s.reason ? '（' + s.reason + '）' : '')], ['批次', s.batch || '—']])];
      if (S.role === 'qc' && s.status === '待质检') {
        const why = sel(['口型与配音不同步', '分镜跳轴', '画面闪烁/穿模', '字幕错误', '色调不统一']);
        body.push(h('h4', '质检判定'), h('div.wf-form', btn('通过', () => { s.history.push({ t: now(), who: me(), what: 'v' + s.ver + ' 通过' }); s.status = '通过'; s.reason = ''; audit(s.id, '质检通过', 'v' + s.ver + ' 待质检', '通过'); commit(); closeDrawer(); }, 'pri'), field('退回原因', why), btn('退回返修', () => { s.history.push({ t: now(), who: me(), what: 'v' + s.ver + ' 退回：' + why.value }); s.status = '退回'; s.reason = why.value; s.returns = (s.returns || 0) + 1; audit(s.id, '质检退回', 'v' + s.ver, '退回·' + why.value); commit(); closeDrawer(); }, 'danger')));
      }
      if (S.role === 'prod_lead' && s.status === '退回') body.push(h('div.wf-form', btn('成员返修后重新提交（沿用片段标识，版本 +1）', () => { s.ver++; s.status = '待质检'; s.history.push({ t: now(), who: me(), what: '返修重新提交 v' + s.ver }); audit(s.id, '返修提交', '退回', 'v' + s.ver + ' 待质检'); commit(); closeDrawer(); }, 'pri')));
      body.push(h('h4', '版本记录'), s.history.length ? timeline(s.history) : h('div.bz-empty', '首次提交'));
      return [s.id, s.project, body];
    };
  }
  function modQC() {
    const segs = S.segs;
    const first = segs.filter((s) => s.status !== '待质检' || s.history.length);
    const ret = segs.filter((s) => s.returns || s.status === '退回').length;
    const sub = '待质检 ' + segs.filter((s) => s.status === '待质检').length + ' · 返工率 ' + pct(ret / segs.length) + ' · 首检不合格率 ' + pct(ret / Math.max(1, first.length));
    const pick = new Set();
    const lead = S.role === 'prod_lead';
    const tb = h('tbody', segs.map((s) => h('tr', h('td', lead && s.status === '通过' && !s.batch ? h('input', { type: 'checkbox', 'aria-label': '选择 ' + s.id, onchange: (e) => (e.target.checked ? pick.add(s.id) : pick.delete(s.id)) }) : ''), h('td.bz-strong.wf-click', { onclick: () => openDrawer(segDrawer(s.id)) }, s.id), h('td', s.project), h('td', 'v' + s.ver), h('td.num', s.sec), h('td', s.by), h('td', s.batch ? pill('已组批 ' + s.batch, 'teal') : statusPill2(s.status)), h('td.bz-muted', s.reason || ''))));
    const body = [h('div.bz-tw.tall', h('table', h('thead', h('tr', ['', '片段', '项目', '版本', '秒数', '提交人', '状态', '退回原因'].map((t) => h('th', t)))), tb))];
    if (lead) body.push(h('div.wf-form.inline', btn('勾选通过片段 → 组成交付批次', () => {
      if (!pick.size) return toast('请先勾选已通过的片段');
      const ids = [...pick]; const p = S.segs.find((s) => s.id === ids[0]).project;
      const id = 'PC-' + ids[0].split('-')[0] + '-' + String(S.batches.length + 7).padStart(2, '0');
      ids.forEach((i) => { S.segs.find((s) => s.id === i).batch = id; });
      S.batches.unshift({ id, project: p, segs: ids, sec: ids.reduce((a, i) => a + S.segs.find((s) => s.id === i).sec, 0), submitted: null, proof: '', signed: null, accepted: null });
      audit(id, '组成交付批次', '', ids.join('、')); commit(); toast('已生成批次 ' + id);
    }, 'pri')));
    body.push(h('h4.wf-h4', '交付批次（对客提交 → 签收 → 验收，分别留证）'), h('div.bz-tw', h('table', h('thead', h('tr', ['批次', '项目', '片段', '秒数', '对客提交', '签收', '验收', ''].map((t) => h('th', t)))),
      h('tbody', S.batches.map((b) => h('tr', h('td.bz-strong', b.id), h('td', b.project), h('td', b.segs.length + ' 段'), h('td.num', b.sec), h('td', b.submitted ? b.submitted + ' · ' + b.proof : '—'), h('td', b.signed || '—'), h('td', b.accepted || '—'),
        h('td', lead ? (!b.submitted ? btn('登记对客提交', () => { b.submitted = now().slice(0, 10); b.proof = '交付单 JD-' + b.submitted.slice(5).replace('-', ''); audit(b.id, '登记对客提交', '', b.proof); commit(); }) : !b.signed ? btn('客户签收', () => { b.signed = now().slice(0, 10); audit(b.id, '登记签收', '', b.signed); commit(); }) : !b.accepted ? btn('客户验收', () => { b.accepted = now().slice(0, 10); audit(b.id, '登记验收', '', b.accepted); commit(); }) : pill('已验收', 'ok')) : '')))))));
    return card('qc', 's12', S.role === 'qc' ? '我的质检任务' : '质检与交付批次', sub, body);
  }
  function statusPill2(s) { return pill(s, { 待质检: 'sky', 通过: 'ok', 退回: 'bad' }[s] || 'teal'); }

  // 人力与算力 · 接单评估（R02）
  const CAP = [
    { team: '制作A组', unit: '工时', avail: 9 * 40 - 24, booked: 330, gpuCap: 2600, gpuUsed: 1900, gpuRes: 420 },
    { team: '制作B组', unit: '工时', avail: 8 * 40 - 16, booked: 250, gpuCap: 2200, gpuUsed: 1500, gpuRes: 300 },
    { team: '制作C组', unit: '工时', avail: 7 * 40, booked: 268, gpuCap: 1800, gpuUsed: 1380, gpuRes: 260 },
    { team: 'AI研发', unit: '工时', avail: 12 * 40 - 40, booked: 452, gpuCap: 1400, gpuUsed: 980, gpuRes: 200 },
  ];
  function modCap() {
    const rows = CAP.filter((c) => S.role === 'ceo' || (S.role === 'ai_lead' ? c.team === 'AI研发' : c.team.startsWith('制作'))).map((c) => ({ ...c, spare: c.avail - c.booked, gspare: c.gpuCap - c.gpuUsed - c.gpuRes, load: c.booked / c.avail }));
    const team = sel(rows.map((r) => r.team)), hrs = inp({ type: 'number', value: 60 }), gpu = inp({ type: 'number', value: 300 });
    const out = h('div.wf-cap-out');
    const evalIt = () => {
      const r = rows.find((z) => z.team === team.value); const nH = +hrs.value, nG = +gpu.value;
      const okH = r.spare >= nH, okG = r.gspare >= nG;
      out.replaceChildren(h('div.' + (okH ? 'ok' : 'no'), h('b', okH ? '人力满足' : '人力不足'), '需 ' + nH + ' 工时 / 余 ' + r.spare + ' 工时'), h('div.' + (okG ? 'ok' : 'no'), h('b', okG ? '算力满足' : '算力不足'), '需 ' + nG + ' GPU·h / 余 ' + r.gspare + ' GPU·h'), h('p.bz-fine', '结论由负责人判断，系统只列出满足项与不足项；未登记假设订单。'));
    };
    [team, hrs, gpu].forEach((e) => e.addEventListener('input', evalIt));
    setTimeout(evalIt);
    return card('cap', 's12', '人力与算力 · 接单评估', '第 45 周（11/02–11/08）· 人力单位：工时；算力单位：A100 GPU·小时（不同规格未换算前分列）', [
      h('div.bz-tw', h('table', h('thead', h('tr', ['团队', '可用工时', '已排工时', '剩余工时', '负荷', '算力上限', '已用', '预留', '可用算力'].map((t, i) => h('th', { class: i ? 'num' : '' }, t)))),
        h('tbody', rows.map((r) => h('tr', h('td.bz-strong', r.team), h('td.num', r.avail), h('td.num', r.booked), h('td.num', { class: 'num ' + (r.spare < 0 ? 'att-miss' : '') }, r.spare), h('td.num', pct(r.load)), h('td.num', r.gpuCap), h('td.num', r.gpuUsed), h('td.num', r.gpuRes), h('td.num.bz-strong', r.gspare)))))),
      S.role === 'ceo' ? h('p.bz-fine', 'CEO 视图只读；接单评估由制作 / AI 负责人操作。') : h('div.wf-form.inline', field('承接团队', team), field('订单所需工时', hrs), field('订单所需算力 GPU·h', gpu), out),
    ]);
  }

  // 班次 · 转班 · 退费（R05）
  function refundDrawer(id) {
    return () => {
      const f = S.refunds.find((z) => z.id === id);
      const body = [kv([['退费单', f.id], ['学员', f.student], ['原报名班次', f.klass], ['申请金额', yuan(f.amount)], ['原因', f.reason], ['登记', f.by + ' · ' + f.at], ['财务状态', f.status], ['实付', yuan(f.paid)]])];
      if (S.role === 'finance' && (f.status === '待财务核对' || f.status === '部分实付')) {
        const a = inp({ type: 'number', value: f.amount - f.paid });
        body.push(h('h4', '核对原报名与实付流水'), h('div.wf-form', field('实际退款金额', a), btn('确认付款', () => { const v = Math.min(+a.value, f.amount - f.paid); if (!(v > 0)) return toast('付款金额需大于 0'); const st0 = f.status; f.paid += v; f.status = f.paid >= f.amount ? '已付' : '部分实付'; audit(f.id, '确认退款', st0, f.status + ' 本次 ' + yuan(v) + '，累计 ' + yuan(f.paid)); commit(); closeDrawer(); }, 'pri')));
      }
      return ['退费 · ' + f.student, f.klass, body];
    };
  }
  function modEdu() {
    const body = [];
    if (S.role === 'teacher' || S.role === 'edu_lead') {
      body.push(h('h4.wf-h4', '杭州 · 班籍'), h('div.bz-tw', h('table', h('thead', h('tr', ['学员', '当前班次', '状态', '转班记录', ''].map((t) => h('th', t)))),
        h('tbody', S.roster.map((s) => h('tr', h('td.bz-strong', s.name), h('td', s.klass), h('td', pill(s.status, s.status === '结业' ? 'ok' : 'teal')), h('td.bz-muted', s.moves.map((m) => m.from + ' → ' + m.to + '（' + m.t + '）').join('；') || '—'),
          h('td', S.role === 'teacher' && s.status === '在读' ? [btn('转班', () => { const to = s.klass.includes('剪辑') ? '杭州 · AI 分镜 6 期' : '杭州 · 漫剧剪辑 10 期'; s.moves.push({ from: s.klass, to, t: now() }); audit(s.name, '转班', s.klass, to, '保留原班次生效区间'); s.klass = to; commit(); }), btn('登记结业', () => { s.status = '结业'; audit(s.name, '登记结业', '在读', '结业'); commit(); })] : '')))))));
    }
    if (S.role === 'teacher') {
      const stu = sel(S.roster.filter((s) => s.status === '在读').map((s) => s.name)), amt = inp({ type: 'number', value: 6980 }), why = sel(['个人时间冲突', '课程不符合预期', '身体原因', '其他']);
      body.push(h('h4.wf-h4', '登记退费申请'), h('div.wf-form.inline', field('学员', stu), field('申请金额', amt), field('原因', why), btn('提交给财务', () => { const s = S.roster.find((z) => z.name === stu.value); S.refunds.unshift({ id: 'TF-' + now().slice(5, 10).replace('-', '') + '-' + String(S.refunds.length + 1).padStart(2, '0'), student: s.name, klass: s.klass, site: '杭州', amount: +amt.value, reason: why.value, status: '待财务核对', paid: 0, by: '孙老师', at: now().slice(0, 10) }); audit(s.name, '登记退费申请', '', yuan(+amt.value)); commit(); toast('已提交，等待财务核对原报名与实付流水'); }, 'pri')));
    }
    const ppl = new Set(S.refunds.map((f) => f.student)).size;
    body.push(h('h4.wf-h4', '退费单（申请与实际付款分别记录）'), h('div.bz-tw', h('table', h('thead', h('tr', ['退费单', '学员', '班次', '申请', '实付', '原因', '状态'].map((t) => h('th', t)))),
      h('tbody', S.refunds.map((f) => h('tr.wf-click', { onclick: () => openDrawer(refundDrawer(f.id)) }, h('td', f.id), h('td.bz-strong', f.student), h('td', f.klass), h('td.num', nf(f.amount)), h('td.num', nf(f.paid)), h('td.bz-muted', f.reason), h('td', pill(f.status, f.status === '已付' ? 'ok' : f.status === '部分实付' ? 'warn' : 'sky'))))))),
      h('p.bz-fine', '笔数 ' + S.refunds.length + ' · 人数 ' + ppl + ' · 申请金额 ' + yuan(S.refunds.reduce((a, f) => a + f.amount, 0)) + ' · 实付 ' + yuan(S.refunds.reduce((a, f) => a + f.paid, 0))));
    return card('edu', 's12', S.role === 'finance' ? '培训退费核对' : '班次 · 转班 · 退费', S.role === 'finance' ? '跨地点名册不可见，仅见退费单' : '杭州地点', body);
  }

  // AI 服务里程碑（R08）
  const MS_STEPS = [['self', '研发自报完成'], ['internal', '内测通过'], ['sent', '已提交客户'], ['accepted', '客户验收']];
  function msDrawer(id) {
    return () => {
      const m = S.ms.find((z) => z.id === id);
      const body = [kv([['项目', m.project], ['客户', m.customer], ['当前阶段', m.stage], ['关联付款节点', m.node + ' · ' + yuan(m.amount)], ['计划日期', m.plan], ['延期', m.delay ? m.delay + ' 天' : '无']]),
        h('div.wf-steps', MS_STEPS.map(([k, t]) => h('div', { class: m.flags[k] ? 'on' : '' }, h('i'), t))), h('div.wf-steps', h('div', { class: m.triggered ? 'on' : '' }, h('i'), '财务确认转应收'))];
      const nextK = MS_STEPS.find(([k]) => !m.flags[k]);
      if (S.role === 'ai_lead' && nextK) {
        const ev = inp({ placeholder: nextK[0] === 'accepted' ? '客户验收单号 / 邮件' : '凭证：测试报告、交付清单' });
        body.push(h('h4', '推进：' + nextK[1]), h('div.wf-form', field('凭证', ev), btn('确认' + nextK[1], () => { if (!ev.value) return toast('请附凭证'); m.flags[nextK[0]] = true; m.log.push({ t: now(), who: me(), what: nextK[1] + '，凭证：' + ev.value }); audit(m.id + ' ' + m.project, nextK[1], '', ev.value); commit(); }, 'pri')));
      }
      if (S.role === 'finance' && m.flags.accepted && !m.triggered) {
        body.push(h('h4', '触发条件已满足'), h('div.wf-form', btn('确认分期转为应收', () => {
          m.triggered = true; m.log.push({ t: now(), who: me(), what: m.node + ' ' + yuan(m.amount) + ' 转为应收，到期 +15 天' });
          const c = D.ai_contracts.find((a) => a.id === m.id);
          const had = S.inst.find((x) => x.customer === m.customer && x.item.includes(m.node) && x.amount > x.paid);
          if (had) { m.inst = had.id; had.events.push({ t: now(), who: me(), what: '里程碑验收确认，关联本期应收（不重复生成）' }); audit(m.id + ' ' + m.node, '关联已有应收', '', had.id); commit(); return; }
          S.inst.push({ id: 'AR' + (300 + S.inst.length), extra: true, customer: m.customer, contract: 'HT-' + m.id, cname: m.project, camount: c.amount, business: '企业AI服务', period: '第' + (Math.round(c.received / m.amount) + 1) + '期', item: m.project + '·' + m.node, due: '2026-11-20', amount: m.amount, paid: 0, owner: OWNER[m.customer] || '陈思远', events: [{ t: now(), who: me(), what: '客户验收后转为应收' }] });
          m.inst = S.inst[S.inst.length - 1].id; audit(m.id + ' ' + m.node, '转为应收', '待触发', '已触发 ' + yuan(m.amount)); commit();
        }, 'pri')));
      }
      body.push(h('h4', '记录'), m.log.length ? timeline(m.log) : h('div.bz-empty', '暂无'));
      return [m.project, m.customer + ' · ' + m.id, body];
    };
  }
  function modMS() {
    return card('ms', 's12', 'AI 定制项目里程碑', '研发自报、内测、对客提交、客户验收分别留证；验收后由财务转应收', h('div.bz-tw', h('table', h('thead', h('tr', ['编号', '项目', '客户', '阶段', ...MS_STEPS.map((x) => x[1]), '付款节点', '资金状态'].map((t) => h('th', t)))),
      h('tbody', S.ms.map((m) => h('tr.wf-click', { onclick: () => openDrawer(msDrawer(m.id)) }, h('td', m.id), h('td.bz-strong', m.project), h('td', m.customer), h('td', m.stage + (m.delay ? '（延 ' + m.delay + ' 天）' : '')), MS_STEPS.map(([k]) => h('td', m.flags[k] ? '✓' : '·')), h('td', m.node + ' ' + nf(m.amount)), h('td', m.triggered ? pill('已触发', 'warn') : pill('待触发', 'teal'))))))));
  }

  // 权限矩阵与协作授权（R13）
  function grantDrawer(id) {
    return () => {
      const g = S.grants.find((z) => z.id === id);
      const body = [kv([['申请人', g.by], ['授权对象', g.who], ['范围', g.obj], ['动作', g.act], ['原因', g.reason], ['有效期至', g.until], ['批准人', g.approver || '—'], ['状态', g.status]])];
      if (S.role === 'admin' && g.status === '待审批') body.push(h('div.wf-form', btn('批准', () => { g.status = '生效中'; g.approver = '系统管理员'; audit('授权 ' + g.who, '批准协作授权', '待审批', g.obj + ' 至 ' + g.until, g.reason); commit(); closeDrawer(); }, 'pri'), btn('驳回', () => { g.status = '已驳回'; audit('授权 ' + g.who, '驳回协作授权', '待审批', '已驳回'); commit(); closeDrawer(); }, 'danger')));
      if (S.role === 'admin' && g.status === '生效中') body.push(h('div.wf-form', btn('撤销（终止访问与新提醒）', () => { g.status = '已撤销'; audit('授权 ' + g.who, '撤销授权', '生效中', '已撤销'); commit(); closeDrawer(); }, 'danger')));
      return ['协作授权', g.id, body];
    };
  }
  function modPerm() {
    const body = [];
    if (S.role !== 'prod_lead') {
      const lv = { v: '查看', e: '办理', r: '复核' };
      body.push(h('div.bz-tw', h('table.wf-matrix', h('thead', h('tr', h('th', '模块 \\ 岗位'), ROLE_ORDER.map((k) => h('th', ROLES[k].name)))), h('tbody', MODS.filter((m) => m[0] !== 'todo').map((m) => h('tr', h('td.bz-strong', m[1]), ROLE_ORDER.map((k) => h('td', m[2][k] ? pill(lv[m[2][k]], m[2][k] === 'e' ? 'teal' : m[2][k] === 'r' ? 'sky' : 'ok') : h('span.bz-muted', '—')))))))),
        h('p.bz-fine', '建议权限，待客户授权负责人签认。同一授权同时约束首页、详情、搜索、导出与通知；无归属记录进入授权待分派队列。'));
    } else {
      const obj = sel(['HT-AI-2026-031 交付进度', 'HT-MJ-2026-011 交付进度']), who = sel(['郑工（AI服务）', '小林（A组）']), why = inp({ placeholder: '协作原因' }), until = inp({ type: 'date', value: '2026-12-31' });
      body.push(h('div.wf-form.inline', field('协作人员', who), field('授权范围（指定合同）', obj), field('原因', why), field('有效期至', until), btn('申请协作授权', () => { if (!why.value) return toast('请填写原因'); S.grants.unshift({ id: 'SQ-' + String(S.grants.length + 1).padStart(2, '0'), who: who.value, obj: obj.value, act: '查看明细', reason: why.value, approver: '', until: until.value, status: '待审批', by: '周导' }); audit(obj.value, '申请协作授权', '', who.value, why.value); commit(); toast('已提交权限管理员审批'); }, 'pri')));
    }
    body.push(h('h4.wf-h4', '协作授权'), h('div.bz-tw', h('table', h('thead', h('tr', ['编号', '授权对象', '范围', '动作', '原因', '有效期至', '批准人', '状态'].map((t) => h('th', t)))),
      h('tbody', S.grants.map((g) => h('tr.wf-click', { onclick: () => openDrawer(grantDrawer(g.id)) }, h('td', g.id), h('td.bz-strong', g.who), h('td', g.obj), h('td', g.act), h('td.bz-muted', g.reason), h('td', g.until), h('td', g.approver || '—'), h('td', pill(g.status, g.status === '生效中' ? 'ok' : g.status === '待审批' ? 'sky' : 'bad'))))))));
    return card('perm', 's12', S.role === 'prod_lead' ? '跨部门协作授权' : '岗位权限矩阵与协作授权', '角色 × 记录归属 × 字段 × 动作', body);
  }
  function modAudit() {
    return card('audit', 's12', '操作留痕', '核销、复核、授权、导出均可追到人、时间、对象、前后值及依据', S.audit.length ? h('div.bz-tw.tall', h('table', h('thead', h('tr', ['时间', '操作人', '对象', '动作', '前值', '后值', '依据'].map((t) => h('th', t)))), h('tbody', S.audit.map((a) => h('tr', h('td', a.t), h('td', a.who), h('td.bz-strong', a.obj), h('td', a.act), h('td.bz-muted', a.before), h('td', a.after), h('td.bz-muted', a.basis)))))) : h('div.bz-empty', '切换岗位办理业务后，这里会出现操作记录'));
  }

  // 财务：待认领到账
  function bankDrawer(id) {
    return () => {
      const b = S.bank.find((z) => z.id === id);
      const cands = S.inst.filter((x) => x.amount > x.paid && b.payer.includes(x.customer.slice(0, 2)));
      return ['到账待认领', b.id, [kv([['到账日', b.date], ['付款方', b.payer], ['金额', yuan(b.amount)], ['已分摊', yuan(b.used || 0)], ['可用余额', yuan(b.amount - (b.used || 0))], ['附言', b.memo]]), h('h4', '可能对应的应收分期'),
        cands.length ? h('ul.wf-todos', cands.map((x) => h('li', { onclick: () => openDrawer(arDrawer(x.id)) }, h('span.wf-tk', '去核销'), h('span', x.customer + ' ' + x.period + ' · 余额 ' + yuan(x.amount - x.paid))))) : h('div.wf-note', '未匹配到客户，保留在待核队列，交业务认领。')]];
    };
  }

  // ---------- 工作台渲染 ----------
  function render() {
    const R = ROLES[S.role];
    roleSel.value = S.role;
    const n = todos().length;
    todoBtn.querySelector('b').textContent = n;
    todoBtn.classList.toggle('has', n > 0);
    roleBar.replaceChildren(h('span.wf-scope-ic', R.name.slice(0, 1)), h('div', h('b', R.name + ' · ' + R.who), h('span', '数据范围：' + R.scope)), h('div.wf-acts', R.acts.map((a) => h('span', a))));
    const mods = { todo: modTodo, ar: modAR, risk: modRisk, opp: modOpp, score: modScore, qc: modQC, cap: modCap, edu: modEdu, ms: modMS, perm: modPerm, audit: modAudit };
    const order = { ceo: ['todo', 'ar', 'risk', 'cap', 'score', 'ms', 'perm', 'audit'], finance: ['todo', 'ar', 'risk', 'edu', 'ms'], sales_mgr: ['todo', 'opp', 'score', 'risk', 'ar'], sales: ['todo', 'ar', 'opp', 'score'], prod_lead: ['todo', 'qc', 'risk', 'cap', 'perm'], qc: ['todo', 'qc'], edu_lead: ['todo', 'risk', 'edu'], teacher: ['todo', 'edu'], ai_lead: ['todo', 'ms', 'risk', 'cap', 'ar'], admin: ['todo', 'perm', 'audit'] }[S.role];
    const y = window.scrollY;
    const grid = h('div.bz-grid');
    order.forEach((k) => { if (can(k)) grid.append(mods[k]()); });
    // 待办卡与第二张卡并排：第二张若是整行，待办改为整行
    const second = grid.children[1];
    if (second && second.classList.contains('s12')) grid.children[0].classList.replace('s4', 's12');
    wb.replaceChildren(h('div.bz-sec-h', h('h2', '我的工作台'), h('p', '登录后先看本人待办；打开记录可知要补什么、交给谁。切换右上角账号可体验不同岗位的数据范围和操作权限。')), grid);
    window.scrollTo(0, y);
    paintDrawer();
    decorate();
  }

  // ---------- 岗位：页签可见性与遮罩 ----------
  window.__tabAllow = () => ROLES[S.role].tabs;
  function applyRole(switched) {
    const R = ROLES[S.role];
    document.querySelectorAll('.bz-tab').forEach((b) => { b.hidden = !R.tabs.includes(b.dataset.tab); });
    document.getElementById('takeaway').hidden = S.role !== 'ceo';
    document.querySelectorAll('.bz-chip.risk').forEach((c) => { c.hidden = !['ceo', 'finance'].includes(S.role); });
    document.querySelectorAll('.wf-mask').forEach((m) => m.remove());
    document.querySelectorAll('.wf-masked').forEach((m) => m.classList.remove('wf-masked'));
    const mk = MASK[S.role] || {};
    Object.keys(mk).forEach((id) => { const c = document.getElementById(id); if (c && mk[id]) { c.classList.add('wf-masked'); c.append(h('div.wf-mask', h('span', '🔒'), h('b', '无权查看'), h('small', mk[id]))); } });
    if (S.role === 'finance') {
      // 财务看不到个人具名排名等非财务敏感数据，但可看经营总览
    }
    render();
    if (switched) { closeDrawer(); window.__openTab(R.tabs.includes('ov') && S.role === 'ceo' ? 'ov' : 'wb'); toast('已切换为 ' + R.name + ' · ' + R.who); }
  }

  // ---------- 看板联动：点击应收 / 预警直接进入明细 ----------
  function decorate() {
    // 现金流卡的「应收账款」可点开分期
    document.querySelectorAll('#c-ov-cash .bz-cash > div, #c-all-ar .bz-mini3 > div').forEach((d) => {
      if (!/应收/.test(d.textContent) || d.dataset.wf) return;
      d.dataset.wf = 1; d.classList.add('wf-hot'); d.title = '点开查看应收分期'; d.tabIndex = 0;
      const go = () => { window.__openTab('wb'); setTimeout(() => document.getElementById('wf-m-ar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };
      d.addEventListener('click', go); d.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
    // 预警卡片：显示处置状态，点击进入处置
    const all = risks();
    document.querySelectorAll('.bz-alert').forEach((a) => {
      const type = a.querySelector('.bz-alert-top b')?.textContent, item = a.querySelector('.bz-alert-item')?.textContent;
      const r = all.find((z) => z.type === type && z.item === item); if (!r) return;
      a.classList.add('wf-hot'); a.tabIndex = 0;
      const top = a.querySelector('.bz-alert-top'); top.querySelector('.wf-st')?.remove();
      const p = statusPill(r.st.status); p.classList.add('wf-st'); top.append(p);
      if (!a.dataset.wf) { a.dataset.wf = 1; const go = () => openDrawer(riskDrawer(r.key)); a.addEventListener('click', go); a.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }); }
    });
    // 综合看板预警表：加处置状态列
    const tb = document.querySelector('#c-all-alerts tbody');
    if (tb) {
      const th = document.querySelector('#c-all-alerts thead tr');
      if (th && !th.querySelector('.wf-th')) th.append(h('th.wf-th', '处置'));
      tb.querySelectorAll('tr').forEach((tr) => {
        const tds = tr.children; const r = all.find((z) => z.type === tds[2]?.textContent && z.item === tds[3]?.textContent); if (!r) return;
        tr.querySelector('.wf-td')?.remove(); tr.append(h('td.wf-td', statusPill(r.st.status)));
        if (!tr.dataset.wf) { tr.dataset.wf = 1; tr.classList.add('wf-click'); tr.addEventListener('click', () => openDrawer(riskDrawer(r.key))); }
      });
    }
    save();
  }

  sync();
  window.__dashAfter(() => { if (window.__wfReady) decorate(); });
  window.__wfStart = function () { window.__wfReady = true; window.__dashRefresh(); applyRole(false); };
})();
