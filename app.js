// 视图 + 事件。所有插入 innerHTML 的值都来自校验过的数字/枚举/正则字符串或静态数据
import { TIERS, FASTING, metabolism, plan, mealTargets, portion, nightRate, sleepHours, sortByDate, dayNum, movingAverage } from './calc.js';
import { analyze } from './advice.js';
import { FOODS, ROLE_NAMES, MENUS, DESK_ROUTINE, trainingWeek } from './data.js';
import { loadState, saveState, validateProfile, validateLog, validateState, upsertLog, sampleState, todayISO, EMPTY_STATE } from './store.js';
import { weightChart, nightChart } from './charts.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));
const ACTIVITY_LABELS = { sedentary: '久坐 · 办公室，几乎不运动', light: '轻度 · 每周运动 1–3 次', moderate: '中度 · 每周运动 3–5 次' };

let state = loadState();
let ui = { view: state.profile ? 'today' : 'profile', meal: null, picks: [], editDate: null, error: '', flash: '', confirmClear: false };

function setState(next, patch = {}) {
  state = next;
  const saved = saveState(state);
  ui = { ...ui, ...patch, ...(saved ? {} : { error: '保存失败：浏览器存储不可用（是否为无痕模式？）' }) };
  render();
}
const setUi = (patch) => {
  ui = { ...ui, ...patch };
  render();
};

// ---------- 小工具 ----------
const fmt = (n, d = 0) => (n == null ? '—' : Number(n).toFixed(d));
const longDate = (d = new Date()) => d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
const attr = (v) => (v == null ? '' : `value="${v}"`);
const field = (name, label, attrs = '', hint = '') => `
  <div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
const select = (name, label, options, current) => `
  <div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">
    ${Object.entries(options).map(([k, v]) => `<option value="${k}" ${k === current ? 'selected' : ''}>${v}</option>`).join('')}
  </select></div>`;
const messages = () => `<div class="error">${ui.error}</div>${ui.flash ? `<div class="flash">${ui.flash}</div>` : ''}`;
const kpi = (label, num, unit, note) => `<div class="kpi"><div class="eyebrow">${label}</div><div class="num">${num}<small>${unit}</small></div><div class="note">${note}</div></div>`;
const bigNum = (n, unit) => `<div style="font:300 34px/1.1 var(--serif)">${n}<small class="muted" style="font-size:14px"> ${unit}</small></div>`;

function etaText(remaining, weeklyKg) {
  if (remaining <= 0) return '已达成';
  const d = new Date();
  d.setDate(d.getDate() + Math.ceil((remaining / weeklyKg) * 7));
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

function derive() {
  const meta = metabolism(state.profile, state.logs);
  const pl = plan(state.profile, meta);
  const dailyKcal = pl.fastDay?.normalKcal ?? pl.intake;
  return { meta, plan: pl, analysis: analyze(state.profile, state.logs, meta), meals: mealTargets(dailyKcal, state.profile.fasting) };
}

// ---------- 记录表单（今日 / 记录 页共用） ----------
function logForm() {
  const date = ui.editDate ?? todayISO();
  const l = state.logs.find((x) => x.date === date) ?? {};
  return `<form id="log-form" class="form">
    ${field('date', '日期', `type="date" required ${attr(date)}`)}
    ${field('eveningWeight', '昨晚睡前体重 KG', `type="number" step="0.1" inputmode="decimal" ${attr(l.eveningWeight)}`, '睡前排空、穿同样衣物')}
    ${field('morningWeight', '今晨空腹体重 KG', `type="number" step="0.1" inputmode="decimal" ${attr(l.morningWeight)}`, '起床如厕后、进食前')}
    ${field('sleepStart', '入睡时间', `type="time" ${attr(l.sleepStart)}`)}
    ${field('wake', '起床时间', `type="time" ${attr(l.wake)}`)}
    ${field('intake', '当日实际摄入 KCAL', `type="number" inputmode="numeric" ${attr(l.intake)}`, '可选，填写后会校准真实消耗')}
    ${field('steps', '当日步数', `type="number" inputmode="numeric" ${attr(l.steps)}`, '可选')}
  </form>
  <div class="actions"><button class="btn" form="log-form">保存记录</button></div>
  ${messages()}`;
}

function lastNightCard(meta) {
  const last = sortByDate(state.logs).filter((l) => nightRate(l) != null).at(-1);
  if (!last) return `<div class="card"><div class="eyebrow">昨夜 · Overnight</div><h2>还没有夜间数据</h2>
    <p class="muted small">睡前称一次、晨起称一次，并记录睡眠时间。睡眠中的掉秤速率反映你的静息代谢活跃度，系统会以此每日修正基础代谢。</p></div>`;
  const h = sleepHours(last.sleepStart, last.wake);
  const loss = Math.round((last.eveningWeight - last.morningWeight) * 1000);
  const rate = nightRate(last);
  const { baseline, factor } = meta.night;
  const vs = baseline ? `${rate >= baseline ? '高于' : '低于'}个人基线 ${fmt(baseline)} g/h` : '再记录几晚即可建立个人基线';
  return `<div class="card"><div class="eyebrow">昨夜 · ${last.date}</div>
    <div class="grid-3" style="margin-top:18px">
      <div><div class="muted small">睡眠</div>${bigNum(fmt(h, 1), 'h')}</div>
      <div><div class="muted small">掉秤</div>${bigNum(loss, 'g')}</div>
      <div><div class="muted small">速率</div>${bigNum(fmt(rate), 'g/h')}</div>
    </div>
    <p class="muted small" style="margin-bottom:0">${vs} · 今日基础代谢修正 ×${fmt(factor, 3)}</p></div>`;
}

const stageCard = (analysis, label) => `<div class="card dark"><div class="eyebrow">${label}</div>
  <div style="margin:14px 0 6px"><span class="stage-tag">${analysis.stage.name}</span></div>
  <ul class="tips">${analysis.tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>`;

// ---------- 视图 ----------
function viewToday(d) {
  const { meta, plan: pl, analysis } = d;
  const hour = new Date().getHours();
  const greet = hour < 11 ? '早安' : hour < 18 ? '午安' : '晚安';
  const remaining = meta.weight - state.profile.target;
  return `
    <div class="eyebrow">${longDate()}</div>
    <h1>${greet}，今日代谢已更新</h1>
    <p class="lede">${analysis.stage.summary}</p>
    <div class="kpis">
      ${kpi('基础代谢 BMR', meta.bmr, 'kcal', `公式值 ${meta.bmrFormula} · 夜间修正 ×${fmt(meta.night.factor, 3)}`)}
      ${kpi('每日消耗 TDEE', meta.tdee, 'kcal', meta.isAdaptive ? '已按真实摄入与体重校准' : '公式估算 · 记录摄入后自动校准')}
      ${kpi('今日目标摄入', pl.fastDay?.normalKcal ?? pl.intake, 'kcal', `${pl.tier.name}档 · 缺口 ${pl.tier.deficit} kcal`)}
      ${kpi('当前体重', fmt(meta.weight, 1), 'kg', remaining > 0 ? `距目标 ${fmt(remaining, 1)} kg` : '已达目标')}
    </div>
    <div class="grid-2 section">${lastNightCard(meta)}${stageCard(analysis, '阶段分析')}</div>
    <div class="section"><div class="eyebrow">Daily Check-in</div><h2>今日记录</h2>${logForm()}</div>
    <div class="section"><div class="eyebrow">Overnight Metabolism</div><h2>睡眠掉秤</h2>
      ${nightChart(state.logs, meta.night.baseline)}
      <p class="muted small">每根柱子 = 当晚（睡前体重 − 晨起体重）÷ 睡眠时长。深色为最近 3 晚，与金色基线对比判断代谢趋势。</p>
    </div>`;
}

function viewJournal() {
  const rows = sortByDate(state.logs).reverse().map((l) => {
    const rate = nightRate(l);
    return `<tr>
      <td>${l.date}</td><td class="num">${fmt(l.eveningWeight, 1)}</td><td class="num">${fmt(l.morningWeight, 1)}</td>
      <td class="num">${l.sleepStart ? fmt(sleepHours(l.sleepStart, l.wake), 1) : '—'}</td>
      <td class="num">${rate != null ? Math.round((l.eveningWeight - l.morningWeight) * 1000) : '—'}</td>
      <td class="num">${fmt(rate)}</td><td class="num">${fmt(l.intake)}</td><td class="num">${fmt(l.steps)}</td>
      <td class="num"><button class="btn link" data-action="edit-log" data-date="${l.date}">编辑</button>
        <button class="btn link" data-action="delete-log" data-date="${l.date}">删除</button></td></tr>`;
  }).join('');
  return `
    <div class="eyebrow">Journal</div><h1>每日记录</h1>
    <p class="lede">一天一次：睡前称重、晨起空腹称重、记下睡眠时间。每次保存都会重新计算你的基础代谢与方案。</p>
    ${logForm()}
    <div class="section table-wrap">${rows ? `<table>
      <thead><tr><th>日期</th><th class="num">睡前</th><th class="num">晨起</th><th class="num">睡眠 H</th><th class="num">掉秤 G</th><th class="num">G/H</th><th class="num">摄入</th><th class="num">步数</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>` : '<div class="empty">暂无记录</div>'}</div>`;
}

function tierCards(current) {
  return `<div class="tiers">${TIERS.map((t) => `
    <button class="tier ${t.id === current ? 'active' : ''}" data-action="set-tier" data-id="${t.id}">
      <div class="eyebrow ${t.id === current ? 'muted' : ''}">${t.name}</div>
      <div class="num">−${t.deficit}</div>
      <div class="muted small">kcal / 日 · 约 ${fmt((t.deficit * 7) / 7700, 2)} kg / 周</div>
      <div class="desc muted">${t.desc}</div>
    </button>`).join('')}</div>`;
}

function ledgerCard(meta, pl) {
  const remaining = meta.weight - state.profile.target;
  const dietPct = (pl.dietDeficit / pl.tier.deficit) * 100;
  const fastingNote = state.profile.fasting === '16:8'
    ? `<p class="small">进食窗口 ${FASTING['16:8'].window}，其余时间只喝水、黑咖啡、无糖茶。</p>`
    : pl.fastDay ? `<p class="small">每周任选不相邻的 2 天为断食日，全天约 <b>${pl.fastDay.fastKcal}</b> kcal；其余 5 天每日 <b>${pl.fastDay.normalKcal}</b> kcal。</p>` : '';
  return `<div class="card"><div class="eyebrow">能量账本</div>
    <h2 style="margin-top:12px">每日缺口 ${pl.tier.deficit} kcal</h2>
    <div class="bar"><span style="width:${dietPct}%;background:var(--ink)"></span><span style="width:${100 - dietPct}%;background:var(--gold)"></span></div>
    <table><tbody>
      <tr><td>每日消耗 TDEE</td><td class="num">${meta.tdee} kcal</td></tr>
      <tr><td>目标摄入</td><td class="num">${pl.intake} kcal</td></tr>
      <tr><td>■ 饮食缺口</td><td class="num">${pl.dietDeficit} kcal</td></tr>
      <tr><td><span class="gold">■</span> 运动补足</td><td class="num">${pl.exerciseKcal} kcal ${pl.extraSteps ? `≈ 额外 ${pl.extraSteps} 步` : ''}</td></tr>
      <tr><td>预计每周</td><td class="num">−${fmt(pl.weeklyLossKg, 2)} kg</td></tr>
      <tr><td>预计达成目标</td><td class="num">${etaText(remaining, pl.weeklyLossKg)}</td></tr>
    </tbody></table>
    ${pl.belowBmr ? '<p class="small warn">困难模式：摄入低于基础代谢，务必吃够蛋白质并坚持力量训练，建议不超过 4 周。</p>' : ''}
    ${!pl.belowBmr && pl.exerciseKcal ? '<p class="small muted">摄入不低于基础代谢（久坐人群可活动空间小），剩余缺口用步数补足。</p>' : ''}
    ${fastingNote}</div>`;
}

function macroCard(pl) {
  const { protein, fat, carbs } = pl.macros;
  const row = (name, g, k, note) => `<tr><td>${name}<div class="muted small">${note}</div></td><td class="num">${g} g</td><td class="num muted">${g * k} kcal</td></tr>`;
  return `<div class="card"><div class="eyebrow">宏量营养</div><h2 style="margin-top:12px">每日 ${pl.intake} kcal</h2>
    <table><tbody>
      ${row('蛋白质', protein, 4, state.profile.keepMuscle ? '保肌模式 1.8 g/kg' : '1.4 g/kg')}
      ${row('脂肪', fat, 9, '约 27% 热量')}
      ${row('碳水', carbs, 4, '其余热量，优先粗粮')}
    </tbody></table></div>`;
}

function trainingSection() {
  if (!state.profile.keepMuscle) return '<div class="section"><div class="empty">开启「保持肌肉量」后生成每周力量训练计划</div></div>';
  return `<div class="section"><div class="eyebrow">Training</div><h2>保肌训练周计划</h2>
    <div class="grid-3">${trainingWeek(state.profile.tier).map((day) => `
      <div class="meal"><div class="eyebrow">${day.day}</div><div class="dish" style="margin-top:6px">${day.focus}</div>
        <ul class="portion-list">${day.items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`).join('')}
    </div></div>`;
}

function viewPlan(d) {
  const p = state.profile;
  return `
    <div class="eyebrow">Programme</div><h1>减重方案</h1>
    <p class="lede">选择档位与饮食模式。系统每天根据最新体重与夜间代谢重新计算以下所有数字。</p>
    ${tierCards(p.tier)}
    <div class="actions" style="justify-content:space-between">
      <div class="segmented">${Object.entries(FASTING).map(([k, v]) => `<button data-action="set-fasting" data-id="${k}" class="${k === p.fasting ? 'active' : ''}">${v.name}</button>`).join('')}</div>
      <label class="toggle"><input type="checkbox" id="keep-muscle" ${p.keepMuscle ? 'checked' : ''}> 保持肌肉量</label>
    </div>
    <div class="grid-2 section">${ledgerCard(d.meta, d.plan)}${macroCard(d.plan)}</div>
    ${trainingSection()}
    <div class="section"><div class="eyebrow">At the Desk</div><h2>久坐微运动</h2>
      <ul class="tips">${DESK_ROUTINE.map((t) => `<li>${t}</li>`).join('')}</ul></div>`;
}

const portionList = (res) => `<ul class="portion-list">${res.items.map((i) => `<li><span>${i.name}</span><span>${i.grams} g <span class="muted">· ${i.kcalOut} kcal</span></span></li>`).join('')}</ul>
  <p class="muted small">合计 ${res.total.kcal} kcal · 蛋白 ${res.total.protein}g · 碳水 ${res.total.carbs}g · 脂肪 ${res.total.fat}g</p>`;

function builder(meals) {
  const meal = meals.find((m) => m.key === ui.meal) ?? meals[0];
  const picked = ui.picks.map((id) => FOOD_BY_ID[id]);
  const chips = Object.entries(ROLE_NAMES).map(([role, name]) => `
    <div class="eyebrow" style="margin-top:14px">${name}</div>
    <div class="chips">${FOODS.filter((f) => f.role === role).map((f) => `<button class="chip ${ui.picks.includes(f.id) ? 'on' : ''}" data-action="toggle-food" data-id="${f.id}">${f.name}</button>`).join('')}</div>`).join('');
  return `<div class="section"><div class="eyebrow">Compose</div><h2>自选食材 · 份量规划</h2>
    <p class="muted small">选好一餐的食材，按该餐热量自动计算克数（米饭、面类为熟重，其余为生重）。</p>
    <div class="segmented" style="margin:8px 0 12px">${meals.map((m) => `<button data-action="set-meal" data-id="${m.key}" class="${m.key === meal.key ? 'active' : ''}">${m.name} ${m.kcal}</button>`).join('')}</div>
    <div class="grid-2"><div>${chips}</div>
      <div class="card"><div class="eyebrow">${meal.name} · 目标 ${meal.kcal} kcal</div>
        ${picked.length ? portionList(portion(picked, meal.kcal)) : '<p class="muted">从左侧选择食材</p>'}
        ${picked.length ? '<button class="btn link" data-action="clear-picks">清空选择</button>' : ''}
      </div></div></div>`;
}

function viewKitchen(d) {
  const rotation = dayNum(todayISO()) % 3;
  const cards = d.meals.map((m) => {
    const menu = MENUS[m.key][rotation];
    return `<div class="meal"><div class="eyebrow">${m.name} · ${m.time}</div><div class="kcal">${m.kcal}<small class="muted" style="font-size:14px"> kcal</small></div>
      <div class="dish">${menu.name}</div>${portionList(portion(menu.foods.map((id) => FOOD_BY_ID[id]), m.kcal))}</div>`;
  }).join('');
  const fastNote = d.plan.fastDay
    ? `<div class="card section"><div class="eyebrow">断食日</div><p>全天 ${d.plan.fastDay.fastKcal} kcal，建议两餐：早 2 个鸡蛋 + 无糖豆浆；晚 150g 鸡胸/虾仁 + 300g 绿叶菜。多喝水，避免高强度训练。</p></div>` : '';
  return `
    <div class="eyebrow">Kitchen</div><h1>今日膳食</h1>
    <p class="lede">今日目标 ${d.meals.reduce((s, m) => s + m.kcal, 0)} kcal，按「${FASTING[state.profile.fasting].name}」分配。菜单每日轮换。</p>
    <div class="grid-3">${cards}</div>${fastNote}${builder(d.meals)}`;
}

function viewProgress(d) {
  const weighed = sortByDate(state.logs).filter((l) => l.morningWeight);
  const ma = movingAverage(weighed.map((l) => ({ x: dayNum(l.date), y: l.morningWeight })));
  const start = weighed[0]?.morningWeight ?? state.profile.weight;
  const now = ma.at(-1)?.y ?? state.profile.weight;
  const weeks = weighed.length > 1 ? (dayNum(weighed.at(-1).date) - dayNum(weighed[0].date)) / 7 : 0;
  return `
    <div class="eyebrow">Progress</div><h1>体重管理曲线</h1>
    <p class="lede">${d.analysis.stage.summary}</p>
    <div class="kpis">
      ${kpi('起始', fmt(start, 1), 'kg', weighed[0]?.date ?? '—')}
      ${kpi('当前 · 7日均', fmt(now, 1), 'kg', '日常波动已平滑')}
      ${kpi('累计', fmt(now - start, 1), 'kg', weeks ? `平均每周 ${fmt((now - start) / weeks, 2)} kg` : '—')}
      ${kpi('预计达成', etaText(now - state.profile.target, d.plan.weeklyLossKg), '', `按${d.plan.tier.name}档推算`)}
    </div>
    <div class="section">${weightChart(state.logs, state.profile.target, d.plan.weeklyLossKg)}
      <div class="legend"><span><i></i>7 日均线</span><span><i style="border-top:2px dotted var(--muted)"></i>每日晨重</span>
        <span><i style="border-top:2px dashed var(--sage)"></i>方案预测</span><span><i style="border-top:2px dotted var(--gold)"></i>目标</span></div></div>
    <div class="grid-2 section">
      ${stageCard(d.analysis, '当前阶段')}
      <div><div class="eyebrow">Overnight</div><h2>睡眠掉秤</h2>${nightChart(state.logs, d.meta.night.baseline)}</div>
    </div>`;
}

function viewProfile() {
  const p = state.profile ?? { sex: 'female', activity: 'sedentary' };
  const welcome = !state.profile;
  return `
    <div class="eyebrow">${welcome ? 'Welcome' : 'Profile'}</div>
    <h1>${welcome ? '从了解你的身体开始' : '身体档案'}</h1>
    <p class="lede">${welcome ? '填写基本指标，我们会为久坐的你计算基础代谢，并生成分档减重方案。也可以先加载演示数据看看效果。' : '更新后所有计算即时刷新。日常体重变化请在「记录」中填写。'}</p>
    <form id="profile-form" class="form">
      ${select('sex', '性别', { female: '女', male: '男' }, p.sex)}
      ${field('age', '年龄', `type="number" required ${attr(p.age)}`)}
      ${field('height', '身高 CM', `type="number" step="0.1" required ${attr(p.height)}`)}
      ${field('weight', '初始体重 KG', `type="number" step="0.1" required ${attr(p.weight)}`)}
      ${field('target', '目标体重 KG', `type="number" step="0.1" required ${attr(p.target)}`)}
      ${field('bodyFat', '体脂率 %', `type="number" step="0.1" ${attr(p.bodyFat)}`, '可选，有体脂秤数据时 BMR 更准')}
      ${select('activity', '日常活动水平', ACTIVITY_LABELS, p.activity)}
    </form>
    <div class="actions"><button class="btn" form="profile-form">${welcome ? '开始' : '保存档案'}</button>
      ${welcome ? '<button class="btn ghost" data-action="load-sample">加载演示数据</button>' : ''}</div>
    ${messages()}
    <hr class="rule">
    <div class="eyebrow">Data</div><h2>数据</h2>
    <p class="muted small">数据只保存在当前浏览器。换设备前请先导出。</p>
    <div class="actions">
      <button class="btn ghost" data-action="export">导出 JSON</button>
      <label class="btn ghost">导入 JSON<input type="file" id="import-file" accept="application/json" hidden></label>
      <button class="btn ghost" data-action="load-sample">加载演示数据</button>
      <button class="btn link" data-action="clear">${ui.confirmClear ? '再次点击确认清空' : '清空全部数据'}</button>
    </div>`;
}

const VIEWS = { today: viewToday, journal: viewJournal, plan: viewPlan, kitchen: viewKitchen, progress: viewProgress, profile: viewProfile };

function render() {
  const view = state.profile ? ui.view : 'profile';
  nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  app.innerHTML = VIEWS[view](state.profile ? derive() : null);
}

// ---------- 事件 ----------
const clearMsg = { error: '', flash: '', confirmClear: false };

nav.addEventListener('click', (e) => {
  const view = e.target.closest('button')?.dataset.view;
  if (!view) return;
  if (!state.profile && view !== 'profile') return setUi({ ...clearMsg, error: '请先填写身体档案' });
  setUi({ ...clearMsg, view, editDate: null });
  window.scrollTo({ top: 0 });
});

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `leger-${todayISO()}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}

const ACTIONS = {
  'set-tier': (id) => setState({ ...state, profile: { ...state.profile, tier: id } }),
  'set-fasting': (id) => setState({ ...state, profile: { ...state.profile, fasting: id } }, { meal: null }),
  'set-meal': (id) => setUi({ meal: id }),
  'toggle-food': (id) => setUi({ picks: ui.picks.includes(id) ? ui.picks.filter((x) => x !== id) : [...ui.picks, id] }),
  'clear-picks': () => setUi({ picks: [] }),
  'edit-log': (_, date) => {
    setUi({ ...clearMsg, editDate: date });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  'delete-log': (_, date) => setState({ ...state, logs: state.logs.filter((l) => l.date !== date) }, { ...clearMsg, flash: `已删除 ${date}` }),
  'load-sample': () => setState(sampleState(), { ...clearMsg, view: 'today' }),
  export: exportData,
  clear: () => (ui.confirmClear
    ? setState(EMPTY_STATE, { ...clearMsg, view: 'profile', picks: [] })
    : setUi({ confirmClear: true })),
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  ACTIONS[el.dataset.action]?.(el.dataset.id, el.dataset.date);
});

app.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = Object.fromEntries(new FormData(e.target));
  if (e.target.id === 'profile-form') {
    const { value, error } = validateProfile({ tier: 'standard', fasting: 'none', keepMuscle: true, ...state.profile, ...raw });
    if (error) return setUi({ ...clearMsg, error });
    return setState({ ...state, profile: value }, { ...clearMsg, flash: '档案已保存', view: state.profile ? ui.view : 'today' });
  }
  if (e.target.id === 'log-form') {
    const { value, error } = validateLog(raw);
    if (error) return setUi({ ...clearMsg, error });
    return setState({ ...state, logs: upsertLog(state.logs, value) }, { ...clearMsg, editDate: null, flash: `${value.date} 已保存，代谢与方案已重新计算` });
  }
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'keep-muscle') setState({ ...state, profile: { ...state.profile, keepMuscle: e.target.checked } });
  if (e.target.id === 'f-date') setUi({ ...clearMsg, editDate: e.target.value });
  if (e.target.id === 'import-file') importFile(e.target.files[0]);
});

async function importFile(file) {
  if (!file) return;
  try {
    const { value, error } = validateState(JSON.parse(await file.text()));
    if (error) return setUi({ ...clearMsg, error: `导入失败：${error}` });
    setState(value, { ...clearMsg, flash: `已导入 ${value.logs.length} 条记录` });
  } catch (err) {
    console.error('[leger] 导入失败', err);
    setUi({ ...clearMsg, error: '导入失败：文件不是有效的 JSON' });
  }
}

render();
