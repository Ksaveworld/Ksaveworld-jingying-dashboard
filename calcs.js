// 示例数据文件中的各张表
dash.loader('fin_monthly', { description: '取示例文件中的 fin_monthly 表', fn: ({ answer }) => answer.fin_monthly });
dash.loader('fin_cash', { description: '取示例文件中的 fin_cash 表', fn: ({ answer }) => answer.fin_cash });
dash.loader('fin_receivables', { description: '取示例文件中的 fin_receivables 表', fn: ({ answer }) => answer.fin_receivables });
dash.loader('edu_monthly', { description: '取示例文件中的 edu_monthly 表', fn: ({ answer }) => answer.edu_monthly });
dash.loader('edu_channels', { description: '取示例文件中的 edu_channels 表', fn: ({ answer }) => answer.edu_channels });
dash.loader('edu_sites', { description: '取示例文件中的 edu_sites 表', fn: ({ answer }) => answer.edu_sites });
dash.loader('prod_projects', { description: '取示例文件中的 prod_projects 表', fn: ({ answer }) => answer.prod_projects });
dash.loader('prod_daily', { description: '取示例文件中的 prod_daily 表', fn: ({ answer }) => answer.prod_daily });
dash.loader('prod_teams', { description: '取示例文件中的 prod_teams 表', fn: ({ answer }) => answer.prod_teams });
dash.loader('ai_contracts', { description: '取示例文件中的 ai_contracts 表', fn: ({ answer }) => answer.ai_contracts });
dash.loader('ai_monthly', { description: '取示例文件中的 ai_monthly 表', fn: ({ answer }) => answer.ai_monthly });
dash.loader('sales_reps', { description: '取示例文件中的 sales_reps 表', fn: ({ answer }) => answer.sales_reps });
dash.loader('sales_sources', { description: '取示例文件中的 sales_sources 表', fn: ({ answer }) => answer.sales_sources });
dash.loader('sales_lost', { description: '取示例文件中的 sales_lost 表', fn: ({ answer }) => answer.sales_lost });
dash.loader('sales_stale', { description: '取示例文件中的 sales_stale 表', fn: ({ answer }) => answer.sales_stale });
dash.loader('hr_depts', { description: '取示例文件中的 hr_depts 表', fn: ({ answer }) => answer.hr_depts });
dash.loader('res_compute', { description: '取示例文件中的 res_compute 表', fn: ({ answer }) => answer.res_compute });

// ---------- 总看板 ----------
dash.calc('backlog', {
  title: '在手订单与待交付项目',
  description: '漫剧制作按未交付秒数折算剩余合同额、进度为已交付秒数占比；AI 定制项目按合同额减已回款、进度按所处阶段（5 个阶段）折算。以 2026-10-31 为基准日。',
  inputs: ['prod_projects', 'prod_teams', 'ai_contracts'],
  fn: (prod, teams, ai) => {
    const asOf = new Date('2026-10-31');
    const daysTo = (s) => Math.round((new Date(s) - asOf) / 864e5);
    const perTeam = {};
    prod.forEach((p) => { perTeam[p.team] = (perTeam[p.team] || 0) + 1; });
    const rows = prod.map((p) => {
      const t = teams.find((x) => x.team === p.team);
      const daily = t ? +t.avg_output_sec_day / perTeam[p.team] : 0;
      const need = daily ? Math.ceil(+p.pending_sec / daily) : null;
      const left = +p.days_left;
      const status = left < 0 ? '逾期' : need != null && need > left ? '延期风险' : left <= 14 ? '临期' : '正常';
      return { project: p.project, business: '漫剧制作', customer: p.customer, contract: +p.contract,
        remaining: Math.round(+p.contract * (1 - +p.progress)), start: p.start, due: p.due, progress: +p.progress,
        days_left: left, days_needed: need, status };
    });
    ai.filter((a) => a.type === '定制项目' && a.stage !== '售后运维').forEach((a) => {
      const left = daysTo(a.plan_date);
      const status = +a.delay_days > 0 || left < 0 ? '延期' : left <= 14 ? '临期' : '正常';
      const steps = ['需求确认', '开发', '测试', '上线', '售后运维'];
      rows.push({ project: a.project, business: '企业AI服务', customer: a.customer, contract: +a.amount,
        remaining: +a.amount - +a.received, start: a.start, due: a.plan_date, progress: Math.round(steps.indexOf(a.stage) / 4 * 100) / 100,
        days_left: left, days_needed: null, status });
    });
    return rows.sort((a, b) => a.days_left - b.days_left);
  },
});

dash.calc('kpi_ov', {
  title: '总看板指标',
  description: '10 月与 9 月对比；金额单位为万元；人效 = 今年累计营收 ÷ 10 月在职人数；达成率 = 实际 ÷ 月度目标（目标为示例值）。',
  inputs: ['fin_monthly', 'backlog'],
  fn: (fin, backlog) => {
    const cur = fin[fin.length - 1], prev = fin[fin.length - 2];
    const w = (v) => Math.round(+v / 1000) / 10;
    const chg = (a, b) => (+b ? Math.round((+a / +b - 1) * 1000) / 1000 : null);
    const ytd = fin.reduce((s, r) => s + +r.revenue, 0);
    return [{
      rev_m: w(cur.revenue), rev_mom: chg(cur.revenue, prev.revenue),
      collected_m: w(cur.collected), collect_ratio: Math.round(+cur.collected / +cur.revenue * 1000) / 1000,
      gp_m: w(cur.gross_profit), gm_m: Math.round(+cur.gross_profit / +cur.revenue * 1000) / 1000,
      gm_chg: Math.round((+cur.gross_profit / +cur.revenue - +prev.gross_profit / +prev.revenue) * 1000) / 1000,
      np_m: w(cur.net_profit), np_mom: chg(cur.net_profit, prev.net_profit),
      nm_m: Math.round(+cur.net_profit / +cur.revenue * 1000) / 1000,
      backlog: w(backlog.reduce((s, r) => s + r.remaining, 0)), backlog_n: backlog.length,
      late_n: backlog.filter((r) => r.status !== '正常').length,
      leads_m: +cur.leads_total, leads_mom: chg(cur.leads_total, prev.leads_total),
      newcust_m: +cur.new_customers, newcust_mom: chg(cur.new_customers, prev.new_customers),
      rev_ytd: w(ytd), rev_per_head: w(ytd / +cur.headcount), headcount: +cur.headcount,
      rev_target_m: w(cur.rev_target), rev_att: Math.round(+cur.revenue / +cur.rev_target * 1000) / 1000,
      rev_short_m: w(Math.max(0, +cur.rev_target - +cur.revenue)),
      np_target_m: w(cur.np_target), np_att: Math.round(+cur.net_profit / +cur.np_target * 1000) / 1000,
      ytd_target: w(fin.reduce((s, r) => s + +r.rev_target, 0)),
      ytd_att: Math.round(ytd / fin.reduce((s, r) => s + +r.rev_target, 0) * 1000) / 1000,
      months_hit: fin.filter((r) => +r.revenue >= +r.rev_target).length, months_n: fin.length,
    }];
  },
});

dash.calc('rev_mix', {
  title: '今年累计营收结构',
  description: '1–10 月各业务营收合计（元）。',
  inputs: ['fin_monthly'],
  fn: (fin) => [
    { business: '漫剧制作', revenue: fin.reduce((s, r) => s + +r.rev_prod, 0) },
    { business: '漫剧招生', revenue: fin.reduce((s, r) => s + +r.rev_edu, 0) },
    { business: '企业AI服务', revenue: fin.reduce((s, r) => s + +r.rev_ai, 0) },
  ],
});

// ---------- 漫剧招生 ----------
dash.calc('edu_unit', {
  title: '招生单位经济（按月）',
  description: '获客成本 = 广告投放 ÷ 报名人数；单学员毛利 = (学费收入 − 退费 − 投放 − 平台成本 − 教学成本) ÷ 报名人数。',
  inputs: ['edu_monthly'],
  fn: (edu) => edu.map((r) => {
    const n = +r.enrolled;
    return {
      month: r.month,
      cpl: Math.round(+r.ad_spend / +r.leads),
      cac: Math.round(+r.ad_spend / n),
      conv: Math.round(n / +r.leads * 10000) / 10000,
      refund_rate: Math.round(+r.refunds / n * 1000) / 1000,
      cost_per_student: Math.round((+r.ad_spend + +r.platform_cost + +r.teach_cost) / n),
      gross_per_student: Math.round((+r.revenue - +r.refund_amount - +r.ad_spend - +r.platform_cost - +r.teach_cost) / n),
    };
  }),
});

dash.calc('kpi_edu', {
  title: '招生指标',
  description: '10 月数值；对比基准为 7–9 月平均；结业率 = 已结业 ÷ (报名 − 在训)；投放预算使用 = 10 月投放 ÷ 月预算 42 万。',
  inputs: ['edu_monthly', 'edu_unit', 'edu_sites'],
  fn: (edu, unit, sites) => {
    const cur = edu[edu.length - 1], u = unit[unit.length - 1];
    const p3 = unit.slice(-4, -1);
    const avg = (k) => p3.reduce((s, r) => s + +r[k], 0) / p3.length;
    const rel = (a, b) => Math.round((a / b - 1) * 1000) / 1000;
    const fin = sites.reduce((s, r) => s + +r.students - +r.in_training, 0);
    return [{
      leads: +cur.leads, enrolled: +cur.enrolled, conv: u.conv, conv_vs: rel(u.conv, avg('conv')),
      cac: u.cac, cac_vs: rel(u.cac, avg('cac')), cpl: u.cpl,
      gross_ps: u.gross_per_student, gross_vs: rel(u.gross_per_student, avg('gross_per_student')),
      refunds: +cur.refunds, refund_rate: u.refund_rate,
      enroll_target: +cur.enroll_target, months_hit: edu.filter((r) => +r.enrolled >= +r.enroll_target).length, months_n: edu.length,
      ad_w: Math.round(+cur.ad_spend / 1000) / 10, ad_budget_use: Math.round(+cur.ad_spend / 420000 * 1000) / 1000, platform_w: Math.round(+cur.platform_cost / 1000) / 10,
      completion: Math.round(sites.reduce((s, r) => s + +r.graduated, 0) / fin * 1000) / 1000,
      classes: sites.reduce((s, r) => s + +r.classes, 0),
    }];
  },
});

dash.calc('edu_funnel', {
  title: '10 月招生漏斗',
  description: '取 edu_monthly 最近一个月的各环节人数。',
  inputs: ['edu_monthly'],
  fn: (edu) => {
    const c = edu[edu.length - 1];
    return [
      { stage: '广告曝光', count: +c.impressions },
      { stage: '留资线索', count: +c.leads },
      { stage: '加微信', count: +c.wechat_added },
      { stage: '试听到课', count: +c.trial },
      { stage: '报名缴费', count: +c.enrolled },
    ];
  },
});

// ---------- 漫剧制作 ----------
dash.calc('kpi_prod', {
  title: '制作指标',
  description: '产能与返工按 10 月逐日数据；返工率 = 返工秒数 ÷ 产出秒数；及时率 = 按时交付节点 ÷ 到期节点；预计毛利按当前成本 ÷ 完成度外推。',
  inputs: ['prod_projects', 'prod_daily'],
  fn: (prod, daily) => {
    const sum = (a, k) => a.reduce((s, r) => s + +r[k], 0);
    const last7 = daily.slice(-7), prev = daily.slice(0, -7);
    const contract = sum(prod, 'contract');
    const estCost = sum(prod, 'est_cost_at_finish');
    return [{
      n: prod.length, contract_w: Math.round(contract / 1000) / 10,
      pending: sum(prod, 'pending_sec'),
      out_avg: Math.round(sum(daily, 'output_sec') / daily.length),
      cap_avg: Math.round(sum(daily, 'capacity_sec') / daily.length),
      util: Math.round(sum(daily, 'output_sec') / sum(daily, 'capacity_sec') * 1000) / 1000,
      ontime: Math.round(sum(prod, 'milestones_ontime') / sum(prod, 'milestones_due') * 1000) / 1000,
      rework7: Math.round(sum(last7, 'rework_sec') / sum(last7, 'output_sec') * 1000) / 1000,
      rework_prev: Math.round(sum(prev, 'rework_sec') / sum(prev, 'output_sec') * 1000) / 1000,
      defect7: Math.round(sum(last7, 'defect_sec') / sum(last7, 'output_sec') * 1000) / 1000,
      margin: Math.round((1 - estCost / contract) * 1000) / 1000,
      over_budget: prod.filter((p) => +p.est_cost_at_finish > +p.budget).length,
    }];
  },
});

dash.calc('prod_quality', {
  title: '逐日返工率与不合格率',
  description: '每天返工秒数、不合格秒数各自除以当天产出秒数。',
  inputs: ['prod_daily'],
  fn: (daily) => daily.map((d) => ({
    date: d.date,
    rework_rate: Math.round(+d.rework_sec / +d.output_sec * 1000) / 1000,
    defect_rate: Math.round(+d.defect_sec / +d.output_sec * 1000) / 1000,
  })),
});

// ---------- 企业AI服务 ----------
dash.calc('kpi_ai', {
  title: 'AI 服务指标',
  description: '合同与回款为全部台账；续费率 = 今年已续费 ÷ 今年到期；定制毛利为定制项目合计。',
  inputs: ['ai_contracts', 'ai_monthly'],
  fn: (ai, mon) => {
    const sum = (a, k) => a.reduce((s, r) => s + +r[k], 0);
    const custom = ai.filter((a) => a.type === '定制项目');
    const cur = mon[mon.length - 1], prev = mon[mon.length - 2];
    return [{
      amount_w: Math.round(sum(ai, 'amount') / 1000) / 10,
      received_w: Math.round(sum(ai, 'received') / 1000) / 10,
      receive_rate: Math.round(sum(ai, 'received') / sum(ai, 'amount') * 1000) / 1000,
      custom_active: custom.filter((a) => a.stage !== '售后运维').length,
      delayed: ai.filter((a) => +a.delay_days > 0).length,
      custom_margin: Math.round((1 - sum(custom, 'cost_total') / sum(custom, 'amount')) * 1000) / 1000,
      renew_rate: Math.round(sum(mon, 'renewed') / sum(mon, 'renew_due') * 1000) / 1000,
      upsell_w: Math.round(sum(mon, 'upsell_amount') / 1000) / 10,
      tickets: +cur.tickets, tickets_mom: Math.round((+cur.tickets / +prev.tickets - 1) * 1000) / 1000,
      complaints: +cur.complaints,
    }];
  },
});

// ---------- 企业服务销售 ----------
dash.calc('sales_rank', {
  title: '销售人效排名',
  description: '按目标达成率在组内排名；达成率低于 50% 且为组内最后一名的标为末位。',
  inputs: ['sales_reps'],
  fn: (reps) => {
    const rows = reps.map((r) => ({
      rep: r.rep, group: r.group, leads: +r.leads, calls: +r.calls, visits: +r.visits, opps: +r.opps, won: +r.won,
      won_amount: +r.won_amount, target: +r.target, attainment: +r.attainment, collected: +r.collected,
      win_rate: +r.opps ? Math.round(+r.won / +r.opps * 1000) / 1000 : 0, stale_7d: +r.stale_7d,
    }));
    const groups = [...new Set(rows.map((r) => r.group))];
    groups.forEach((g) => {
      const gs = rows.filter((r) => r.group === g).sort((a, b) => b.attainment - a.attainment);
      gs.forEach((r, i) => { r.rank = i + 1; r.flag = i === gs.length - 1 && r.attainment < 0.5 ? '末位' : ''; });
    });
    return rows.sort((a, b) => (a.group === b.group ? a.rank - b.rank : a.group < b.group ? -1 : 1));
  },
});

dash.calc('sales_group', {
  title: '销售组对比',
  description: '各组合计：达成率 = 成交额 ÷ 目标；转化率 = 成交单数 ÷ 有效线索；人均成交额为万元。',
  inputs: ['sales_reps'],
  fn: (reps) => [...new Set(reps.map((r) => r.group))].map((g) => {
    const gs = reps.filter((r) => r.group === g);
    const s = (k) => gs.reduce((a, r) => a + +r[k], 0);
    return {
      group: g, people: gs.length, won_amount: s('won_amount'), target: s('target'),
      attainment: Math.round(s('won_amount') / s('target') * 1000) / 1000,
      conv: Math.round(s('won') / s('valid_leads') * 1000) / 1000,
      per_head_w: Math.round(s('won_amount') / gs.length / 1000) / 10,
      collect_rate: Math.round(s('collected') / s('won_amount') * 1000) / 1000,
    };
  }),
});

dash.calc('sales_funnel', {
  title: '10 月销售漏斗',
  description: '全部销售合计。',
  inputs: ['sales_reps'],
  fn: (reps) => {
    const s = (k) => reps.reduce((a, r) => a + +r[k], 0);
    return [
      { stage: '线索', count: s('leads') }, { stage: '有效线索', count: s('valid_leads') },
      { stage: '商机', count: s('opps') }, { stage: '报价', count: s('quotes') }, { stage: '成交', count: s('won') },
    ];
  },
});

dash.calc('kpi_sales', {
  title: '销售指标',
  description: '10 月全部销售合计；金额单位万元。',
  inputs: ['sales_reps'],
  fn: (reps) => {
    const s = (k) => reps.reduce((a, r) => a + +r[k], 0);
    return [{
      leads: s('leads'), valid_rate: Math.round(s('valid_leads') / s('leads') * 1000) / 1000,
      opp_rate: Math.round(s('opps') / s('valid_leads') * 1000) / 1000,
      win_rate: Math.round(s('won') / s('opps') * 1000) / 1000, won: s('won'),
      won_w: Math.round(s('won_amount') / 1000) / 10, target_w: Math.round(s('target') / 1000) / 10,
      attainment: Math.round(s('won_amount') / s('target') * 1000) / 1000,
      collected_w: Math.round(s('collected') / 1000) / 10, stale: s('stale_7d'),
      calls: s('calls'), visits: s('visits'), reps_n: reps.length, reps_hit: reps.filter((r) => +r.won_amount >= +r.target).length,
    }];
  },
});

dash.calc('sales_src', {
  title: '线索质量（按来源）',
  description: '有效率 = 有效线索 ÷ 线索；赢单率 = 成交 ÷ 线索。',
  inputs: ['sales_sources'],
  fn: (src) => src.map((r) => ({
    source: r.source, leads: +r.leads, valid: +r.valid, opps: +r.opps, won: +r.won,
    valid_rate: Math.round(+r.valid / +r.leads * 1000) / 1000,
    win_rate: Math.round(+r.won / +r.leads * 1000) / 1000,
  })),
});

// ---------- 综合 ----------
dash.calc('hr_eff', {
  title: '部门人效',
  description: '人均产值 = 今年累计营收 ÷ 人数（万元）；人力成本占比 = 人力成本 ÷ 营收。',
  inputs: ['hr_depts'],
  fn: (d) => d.map((r) => ({
    dept: r.dept, headcount: +r.headcount, revenue_ytd: r.revenue_ytd == null ? null : +r.revenue_ytd,
    per_head_w: r.revenue_ytd == null ? null : Math.round(+r.revenue_ytd / +r.headcount / 1000) / 10,
    labor_cost_ytd: +r.labor_cost_ytd,
    labor_ratio: r.revenue_ytd == null ? null : Math.round(+r.labor_cost_ytd / +r.revenue_ytd * 1000) / 1000,
    load: +r.load,
  })),
});

dash.calc('ar_aging', {
  title: '应收账龄',
  description: '按逾期天数分段汇总应收金额（元）。',
  inputs: ['fin_receivables'],
  fn: (ar) => {
    const b = [['未到期', (d) => d <= 0], ['逾期 1–15 天', (d) => d > 0 && d <= 15], ['逾期 16–30 天', (d) => d > 15 && d <= 30], ['逾期 30 天以上', (d) => d > 30]];
    return b.map(([bucket, f]) => ({ bucket, amount: ar.filter((r) => f(+r.overdue_days)).reduce((s, r) => s + +r.amount, 0) }));
  },
});

dash.calc('res_kpi', {
  title: '资源余量',
  description: '算力为 10 月 GPU 小时；制作余量 = 各组日产能 − 日均产出；AI 研发负荷取部门表。',
  inputs: ['res_compute', 'prod_teams', 'hr_depts'],
  fn: (gpu, teams, depts) => {
    const c = gpu[gpu.length - 1];
    const used = +c.gpu_h_prod + +c.gpu_h_ai + +c.gpu_h_edu;
    const ai = depts.find((d) => d.dept === 'AI研发');
    return [{
      gpu_used: used, gpu_budget: +c.budget_h, gpu_use: Math.round(used / +c.budget_h * 1000) / 1000,
      gpu_cost_w: Math.round(+c.cost / 1000) / 10,
      prod_spare: teams.reduce((s, t) => s + +t.capacity_sec_day - +t.avg_output_sec_day, 0),
      ai_load: ai ? +ai.load : null,
    }];
  },
});

// 统一风险预警：阈值写在函数里，修改即生效
dash.calc('alerts', {
  title: '风险预警',
  description: '按函数里的阈值从各业务数据中筛出的预警，高风险在前。',
  inputs: ['backlog', 'prod_projects', 'prod_daily', 'prod_teams', 'edu_monthly', 'ai_contracts', 'fin_receivables', 'sales_reps', 'res_compute', 'hr_depts'],
  fn: (backlog, prod, daily, teams, edu, ai, ar, reps, gpu, depts) => {
    const T = { refundRate: 0.08, cacJump: 0.2, convDrop: 0.15, adBudget: 420000, costJump: 0.2,
      reworkDaily: 0.10, reworkProj: 0.08, load: 0.95, stale: 8, attainLow: 0.3, dueDays: 14 };
    const out = [];
    const add = (level, area, type, item, detail) => out.push({ level, area, type, item, detail });
    const pct = (v) => (v * 100).toFixed(1) + '%';
    const yuan = (v) => Math.round(v).toLocaleString('zh-CN') + ' 元';
    ar.filter((r) => +r.overdue_days > 0).forEach((r) =>
      add(+r.overdue_days > 30 ? '高' : '中', '财务', '应收款逾期', r.customer + '·' + r.item, '逾期 ' + r.overdue_days + ' 天，' + yuan(+r.amount)));
    const e = edu[edu.length - 1], p3 = edu.slice(-4, -1);
    const avg = (f) => p3.reduce((s, r) => s + f(r), 0) / p3.length;
    const cac = (r) => +r.ad_spend / +r.enrolled, conv = (r) => +r.enrolled / +r.leads;
    const unitCost = (r) => (+r.ad_spend + +r.platform_cost + +r.teach_cost) / +r.enrolled;
    if (cac(e) / avg(cac) - 1 > T.cacJump) add('高', '招生', '获客成本暴涨', '10 月获客成本 ' + yuan(cac(e)), '较 7–9 月均值上涨 ' + pct(cac(e) / avg(cac) - 1));
    if (1 - conv(e) / avg(conv) > T.convDrop) add('高', '招生', '转化率下滑', '线索→报名 ' + pct(conv(e)), '较 7–9 月均值下降 ' + pct(1 - conv(e) / avg(conv)));
    if (+e.refunds / +e.enrolled > T.refundRate) add('高', '招生', '退费超标', '10 月退费 ' + e.refunds + ' 人', '退费率 ' + pct(+e.refunds / +e.enrolled) + '，超过 ' + pct(T.refundRate));
    if (+e.ad_spend > T.adBudget) add('中', '招生', '投放费用超预算', '10 月投放 ' + yuan(+e.ad_spend), '月预算 ' + yuan(T.adBudget));
    if (unitCost(e) / avg(unitCost) - 1 > T.costJump) add('中', '招生', '单学员成本上升', '10 月 ' + yuan(unitCost(e)) + '/人', '较 7–9 月均值上涨 ' + pct(unitCost(e) / avg(unitCost) - 1));
    prod.forEach((p) => {
      const over = +p.est_cost_at_finish / +p.budget - 1;
      if (over > 0) add(over > 0.1 ? '高' : '中', '制作', '成本超预算', p.project, '预计总成本超预算 ' + pct(over));
      if (+p.rework_rate > T.reworkProj) add('中', '制作', '返工率偏高', p.project, '返工率 ' + pct(+p.rework_rate));
    });
    backlog.forEach((b) => {
      if (b.status === '延期风险') add('高', '制作', '交付延期风险', b.project, '剩 ' + b.days_left + ' 天，按当前产能需 ' + b.days_needed + ' 天');
      else if (b.status === '临期' && b.business === '漫剧制作') add('中', '制作', '项目快到期', b.project, '距交付 ' + b.days_left + ' 天');
    });
    const l3 = daily.slice(-3), before = daily.slice(0, -3);
    const rr = (a) => a.reduce((s, d) => s + +d.rework_sec, 0) / a.reduce((s, d) => s + +d.output_sec, 0);
    if (rr(l3) > T.reworkDaily) add('高', '制作', '返工率突然拉高', '近 3 天返工率 ' + pct(rr(l3)), '此前均值 ' + pct(rr(before)));
    ai.filter((a) => +a.delay_days > 0).forEach((a) =>
      add(+a.delay_days > 10 ? '高' : '中', 'AI服务', '项目延期', a.customer + '·' + a.project, '当前阶段「' + a.stage + '」，已延期 ' + a.delay_days + ' 天'));
    reps.forEach((r) => {
      if (+r.stale_7d >= T.stale) add('中', '销售', '长时间未跟进', r.rep + '（' + r.group + '）', r.stale_7d + ' 条线索超 7 天未跟进');
      if (+r.attainment < T.attainLow) add('高', '销售', '业绩末位', r.rep + '（' + r.group + '）', '目标达成率 ' + pct(+r.attainment));
    });
    teams.filter((t) => +t.load >= T.load).forEach((t) => add('中', '资源', '人力负荷饱和', '制作' + t.team, '负荷 ' + pct(+t.load) + '，难以再接新单'));
    depts.filter((d) => +d.load >= T.load).forEach((d) => add('中', '资源', '人力负荷饱和', d.dept, '负荷 ' + pct(+d.load)));
    const g = gpu[gpu.length - 1], used = +g.gpu_h_prod + +g.gpu_h_ai + +g.gpu_h_edu;
    if (used > +g.budget_h) add('高', '资源', '算力超预算', '10 月 GPU ' + used.toLocaleString('zh-CN') + ' 小时', '预算 ' + (+g.budget_h).toLocaleString('zh-CN') + ' 小时，超出 ' + pct(used / +g.budget_h - 1));
    return out.sort((a, b) => (a.level === b.level ? 0 : a.level === '高' ? -1 : 1));
  },
});

dash.calc('sales_radar', {
  title: '销售能力模型（按组）',
  description: '各组人均线索、人均电话、人均上门，以及商机转化率（商机 ÷ 有效线索）、成交率（成交 ÷ 商机）、回款率（回款 ÷ 成交额）、目标达成率。',
  inputs: ['sales_reps'],
  fn: (reps) => [...new Set(reps.map((r) => r.group))].map((g) => {
    const gs = reps.filter((r) => r.group === g);
    const s = (k) => gs.reduce((a, r) => a + +r[k], 0);
    const r3 = (v) => Math.round(v * 1000) / 1000;
    return {
      group: g, leads_pp: Math.round(s('leads') / gs.length), calls_pp: Math.round(s('calls') / gs.length),
      visits_pp: Math.round(s('visits') / gs.length * 10) / 10, opp_rate: r3(s('opps') / s('valid_leads')),
      win_rate: r3(s('won') / s('opps')), collect_rate: r3(s('collected') / s('won_amount')), attainment: r3(s('won_amount') / s('target')),
    };
  }),
});

dash.calc('ai_mix', {
  title: 'AI 服务合同结构',
  description: '按服务类型汇总合同额与已回款（元）。',
  inputs: ['ai_contracts'],
  fn: (ai) => ['定制项目', '运维服务', '订阅服务'].map((t) => {
    const rs = ai.filter((a) => a.type === t);
    return { type: t, n: rs.length, amount: rs.reduce((s, r) => s + +r.amount, 0), received: rs.reduce((s, r) => s + +r.received, 0) };
  }),
});

dash.calc('team_radar', {
  title: '制作团队能力（自有团队）',
  description: '日产能、日均产出、人均日产出（日均产出 ÷ 人数）、交付及时率、质量（1 − 该组项目平均返工率）。外包团队无项目返工数据，未列入。',
  inputs: ['prod_teams', 'prod_projects'],
  fn: (teams, prod) => teams.filter((t) => prod.some((p) => p.team === t.team)).map((t) => {
    const ps = prod.filter((p) => p.team === t.team);
    const rw = ps.reduce((s, p) => s + +p.rework_rate, 0) / ps.length;
    return {
      team: t.team, capacity: +t.capacity_sec_day, output: +t.avg_output_sec_day,
      per_head: Math.round(+t.avg_output_sec_day / +t.members * 10) / 10, ontime: +t.ontime_rate,
      quality: Math.round((1 - rw) * 1000) / 1000, load: +t.load,
    };
  }),
});

dash.calc('edu_best', {
  title: '获客成本最低的渠道',
  description: '10 月各渠道获客成本（投放 ÷ 报名）最低的一个。',
  inputs: ['edu_channels'],
  fn: (ch) => {
    const rows = ch.map((r) => ({ channel: r.channel, cac: Math.round(+r.spend / +r.enrolled) })).sort((a, b) => a.cac - b.cac);
    return rows.slice(0, 1);
  },
});

dash.calc('alert_sum', {
  title: '预警数量',
  description: '全部预警条数与高风险条数。',
  inputs: ['alerts'],
  fn: (al) => [{ total: al.length, high: al.filter((r) => r.level === '高').length }],
});

dash.calc('prod_plan', {
  title: '按工期应完成 vs 实际已交付',
  description: '应完成秒数 = 总秒数 × (开工到 2026-10-31 的天数 ÷ 开工到交付日的天数)，按时间均匀推进估算。',
  inputs: ['prod_projects'],
  fn: (prod) => {
    const asOf = new Date('2026-10-31');
    return prod.map((p) => {
      const s = new Date(p.start), e = new Date(p.due);
      const frac = Math.max(0, Math.min(1, (asOf - s) / (e - s)));
      return { project: p.project.replace(/[《》]/g, ''), delivered: +p.delivered_sec, planned: Math.round(+p.total_sec * frac) };
    });
  },
});
