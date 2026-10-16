// 今日 / 记录 / 曲线 / 档案
import { nightRate, sleepHours, sortByDate, dayNum, movingAverage } from '../calc.js';
import { todayISO } from '../store.js';
import { weightChart, nightChart, waistChart } from '../charts.js';
import { fmt, longDate, attr, field, select, messages, kpi, bigNum, tipsList, etaText } from '../ui.js';

const ACTIVITY_LABELS = { sedentary: '久坐 · 办公室，几乎不运动', light: '轻度 · 每周运动 1–3 次', moderate: '中度 · 每周运动 3–5 次' };

function logForm({ state, ui }) {
  const date = ui.editDate ?? todayISO();
  const l = state.logs.find((x) => x.date === date) ?? {};
  return `<form id="log-form" class="form">
    ${field('date', '日期', `type="date" required ${attr(date)}`)}
    ${field('eveningWeight', '昨晚睡前体重 KG', `type="number" step="0.1" inputmode="decimal" ${attr(l.eveningWeight)}`, '睡前排空、穿同样衣物')}
    ${field('morningWeight', '今晨空腹体重 KG', `type="number" step="0.1" inputmode="decimal" ${attr(l.morningWeight)}`, '起床如厕后、进食前')}
    ${field('sleepStart', '入睡时间', `type="time" ${attr(l.sleepStart)}`)}
    ${field('wake', '起床时间', `type="time" ${attr(l.wake)}`)}
    ${field('intake', '当日实际摄入 KCAL', `type="number" inputmode="numeric" ${attr(l.intake)}`, '可选，在「膳食」页记录已吃会自动同步')}
    ${field('steps', '当日步数', `type="number" inputmode="numeric" ${attr(l.steps)}`, '可选')}
    ${field('waist', '腰围 CM', `type="number" step="0.1" inputmode="decimal" ${attr(l.waist)}`, '可选，每周量一次：肚脐水平、呼气末')}
  </form>
  <div class="actions"><button class="btn" form="log-form">保存记录</button></div>
  ${messages(ui)}`;
}

function lastNightCard(state, meta) {
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

export const stageCard = (analysis, label) => `<div class="card dark"><div class="eyebrow">${label}</div>
  <div style="margin:14px 0 6px"><span class="stage-tag">${analysis.stage.name}</span></div>
  ${tipsList(analysis.tips)}</div>`;

export function viewToday(ctx) {
  const { state, d } = ctx;
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
    <div class="grid-2 section">${lastNightCard(state, meta)}${stageCard(analysis, '阶段分析')}</div>
    <div class="section"><div class="eyebrow">Daily Check-in</div><h2>今日记录</h2>${logForm(ctx)}</div>
    <div class="section"><div class="eyebrow">Overnight Metabolism</div><h2>睡眠掉秤</h2>
      ${nightChart(state.logs, meta.night.baseline)}
      <p class="muted small">每根柱子 = 当晚（睡前体重 − 晨起体重）÷ 睡眠时长。深色为最近 3 晚，与金色基线对比判断代谢趋势。</p>
    </div>`;
}

export function viewJournal(ctx) {
  const rows = sortByDate(ctx.state.logs).reverse().map((l) => {
    const rate = nightRate(l);
    return `<tr>
      <td>${l.date}</td><td class="num">${fmt(l.eveningWeight, 1)}</td><td class="num">${fmt(l.morningWeight, 1)}</td>
      <td class="num">${l.sleepStart ? fmt(sleepHours(l.sleepStart, l.wake), 1) : '—'}</td>
      <td class="num">${rate != null ? Math.round((l.eveningWeight - l.morningWeight) * 1000) : '—'}</td>
      <td class="num">${fmt(rate)}</td><td class="num">${fmt(l.intake)}</td><td class="num">${fmt(l.steps)}</td><td class="num">${fmt(l.waist, 1)}</td>
      <td class="num"><button class="btn link" data-action="edit-log" data-date="${l.date}">编辑</button>
        <button class="btn link" data-action="delete-log" data-date="${l.date}">删除</button></td></tr>`;
  }).join('');
  return `
    <div class="eyebrow">Journal</div><h1>每日记录</h1>
    <p class="lede">一天一次：睡前称重、晨起空腹称重、记下睡眠时间。每次保存都会重新计算你的基础代谢与方案。</p>
    ${logForm(ctx)}
    <div class="section table-wrap">${rows ? `<table>
      <thead><tr><th>日期</th><th class="num">睡前</th><th class="num">晨起</th><th class="num">睡眠 H</th><th class="num">掉秤 G</th><th class="num">G/H</th><th class="num">摄入</th><th class="num">步数</th><th class="num">腰围</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>` : '<div class="empty">暂无记录</div>'}</div>`;
}

export function viewProgress({ state, d }) {
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
    <div class="section"><div class="eyebrow">Waist</div><h2>腰围</h2>
      ${waistChart(state.logs)}
      ${d.analysis.waist != null ? `<p class="muted small">近 3 周 ${d.analysis.waist > 0 ? '+' : ''}${d.analysis.waist} cm · 体重平台期时，腰围比体重更能反映脂肪变化。</p>` : ''}
    </div>
    <div class="grid-2 section">
      ${stageCard(d.analysis, '当前阶段')}
      <div><div class="eyebrow">Overnight</div><h2>睡眠掉秤</h2>${nightChart(state.logs, d.meta.night.baseline)}</div>
    </div>`;
}

export function viewProfile({ state, ui }) {
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
    ${messages(ui)}
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
