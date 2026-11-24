// 独立运行层：替代 Claude 看板环境，读取示例数据、执行计算、调度绘制
(function () {
  const loaders = {}, calcs = {}, draws = {}, cache = {};
  let DATA = null;
  window.dash = {
    loader(id, o) { loaders[id] = o.fn; },
    calc(id, o) { calcs[id] = o; },
    data(id) {
      if (!DATA) return { status: 'loading', data: [] };
      if (cache[id]) return cache[id];
      let r;
      try {
        if (calcs[id]) {
          const ins = calcs[id].inputs.map((i) => dash.data(i));
          if (ins.some((x) => x.status !== 'ok')) return { status: 'error', data: null };
          r = { status: 'ok', data: calcs[id].fn(...ins.map((x) => x.data)) };
        } else if (loaders[id]) r = { status: 'ok', data: loaders[id]({ answer: DATA }) };
        else r = { status: 'missing', data: [] };
      } catch (e) { console.error(id, e); r = { status: 'error', data: [], message: String(e) }; }
      return (cache[id] = r);
    },
    draw(name, fn) { if (fn) draws[name] = fn; else run(name); },
    onData(fn) { fn(); },
    setLink(id) { try { history.replaceState(null, '', id ? '#' + id : location.pathname); } catch (e) {} requestAnimationFrame(runAll); },
    params() { return {}; }, setParams() {}, resetParams() {}, refresh() {}, colors: [],
  };
  function run(name) {
    const fn = draws[name]; if (!fn) return;
    document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => {
      if (el.closest('[hidden]')) return;
      try { fn(el); } catch (e) { console.error(name, e); }
    });
  }
  const after = [];
  function runAll() { Object.keys(draws).forEach(run); after.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
  window.__dashStart = function (data) { DATA = data; runAll(); };
  // 业务动作（核销、处置等）改动数据后调用：清空计算缓存并重绘
  window.__dashRefresh = function () { Object.keys(cache).forEach((k) => delete cache[k]); runAll(); };
  window.__dashAfter = function (f) { after.push(f); };
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(runAll, 150); });
})();
