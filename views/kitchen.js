// 膳食页：按剩余热量 + 蛋白质缺口推荐每餐，多套可选、换一换、记录已吃
import { FASTING } from '../calc.js';
import { PREF_GROUPS } from '../data.js';
import { candidates, recommend, MIN_MEAL_KCAL } from '../menu.js';
import { esc, kpi, portionList, messages, tipsList } from '../ui.js';
import { MEAL_RULES, SOURCES } from '../guide.js';

const PER_PAGE = 3;

// 渲染与「就吃这个」共用，保证记录的就是看到的那一套
export function mealOptions(d, ui, meal) {
  const pool = ui.source === 'pantry' ? d.pantryPool : d.pool;
  const ranked = recommend(meal, candidates(meal.key, pool, ui.source));
  if (ranked.length <= PER_PAGE) return { options: ranked, total: ranked.length };
  const page = ui.menuPage[meal.key] ?? 0;
  const options = Array.from({ length: PER_PAGE }, (_, i) => ranked[(page * PER_PAGE + i) % ranked.length]);
  return { options, total: ranked.length };
}

export function selectedOption(d, ui, meal) {
  const { options } = mealOptions(d, ui, meal);
  return options[Math.min(ui.menuSel[meal.key] ?? 0, options.length - 1)];
}

const manualForm = (key) => `<form class="eat-form" data-meal="${key}">
  <input name="kcal" type="number" min="0" max="5000" placeholder="热量 kcal" aria-label="这一餐热量" required>
  <input name="protein" type="number" min="0" max="300" placeholder="蛋白 g" aria-label="这一餐蛋白质">
  <button class="btn link">手动记录</button></form>`;

function eatenCard(meal) {
  return `<div class="meal done"><div class="eyebrow">${meal.name} · 已记录</div>
    <div class="kcal">${meal.eaten.kcal}<small class="muted" style="font-size:14px"> kcal</small></div>
    <div class="dish">${esc(meal.eaten.name)}</div>
    <p class="muted small">蛋白质 ${meal.eaten.protein} g</p>
    <button class="btn link" data-action="uneat" data-meal="${meal.key}">撤销</button></div>`;
}

function optionBody(d, ui, meal) {
  if (meal.kcal < MIN_MEAL_KCAL) return '<p class="muted small">今日剩余热量已不足一餐。饿的话选蔬菜、清汤或无糖茶。</p>';
  const { options, total } = mealOptions(d, ui, meal);
  if (!options.length) return `<p class="muted small">${ui.source === 'pantry' ? '冰箱里的食材不够组成这一餐，去「食材」页多勾选几样。' : '没有符合忌口的搭配，去「食材」页调整偏好。'}</p>`;
  const sel = Math.min(ui.menuSel[meal.key] ?? 0, options.length - 1);
  const tabs = options.map((o, i) => `<button class="opt ${i === sel ? 'on' : ''}" data-action="select-option" data-meal="${meal.key}" data-idx="${i}">
    <span>${esc(o.name)}</span>${o.composed ? '<em>组菜</em>' : ''}</button>`).join('');
  return `<div class="opts">${tabs}</div>
    ${portionList(options[sel].res)}
    <div class="meal-actions">
      <button class="btn" data-action="eat-option" data-meal="${meal.key}">就吃这个</button>
      ${total > PER_PAGE ? `<button class="btn ghost" data-action="shuffle" data-meal="${meal.key}">换一换</button>` : ''}
      <span class="muted small">共 ${total} 套</span>
    </div>`;
}

function openCard(d, ui, meal) {
  return `<div class="meal"><div class="eyebrow">${meal.name} · ${meal.time}</div>
    <div class="kcal">${meal.kcal}<small class="muted" style="font-size:14px"> kcal · 蛋白 ${meal.protein} g</small></div>
    ${optionBody(d, ui, meal)}
    ${manualForm(meal.key)}</div>`;
}

function prefSummary(state) {
  const groups = state.prefs.groups.map((g) => PREF_GROUPS[g].name);
  const single = state.prefs.exclude.length;
  const parts = [...groups, ...(single ? [`另排除 ${single} 种食材`] : [])];
  return parts.length ? `已按偏好避开：${parts.join('、')}` : '未设置忌口';
}

export function viewKitchen({ state, ui, d }) {
  const r = d.remaining;
  const target = d.meals.reduce((s, m) => s + m.kcal, 0);
  const fastNote = d.plan.fastDay
    ? `<div class="card section"><div class="eyebrow">断食日</div><p>全天 ${d.plan.fastDay.fastKcal} kcal，建议两餐：早 2 个鸡蛋 + 无糖豆浆；晚 150g 鸡胸/虾仁 + 300g 绿叶菜。多喝水，避免高强度训练。</p></div>` : '';
  return `
    <div class="eyebrow">Kitchen</div><h1>今日膳食</h1>
    <p class="lede">按「${FASTING[state.profile.fasting].name}」分配。每吃完一餐点「就吃这个」或手动记录，剩下的餐会按剩余热量和蛋白质重新推荐。</p>
    <div class="kpis">
      ${kpi('今日目标', target, 'kcal', `蛋白质 ${d.plan.macros.protein} g`)}
      ${kpi('已吃', r.eatenKcal, 'kcal', `蛋白质 ${r.eatenProtein} g`)}
      ${kpi('剩余热量', r.leftKcal, 'kcal', r.eatenKcal > target ? '<span class="warn">已超出目标</span>' : '分摊到未吃的餐')}
      ${kpi('剩余蛋白', r.leftProtein, 'g', r.leftProtein > 0 ? '推荐优先补足' : '已达标')}
    </div>
    <div class="actions" style="justify-content:space-between">
      <div class="segmented">
        <button data-action="set-source" data-id="library" class="${ui.source === 'library' ? 'active' : ''}">菜单库推荐</button>
        <button data-action="set-source" data-id="pantry" class="${ui.source === 'pantry' ? 'active' : ''}">冰箱食材组菜 · ${d.pantryPool.length}</button>
      </div>
      <span class="muted small">${prefSummary(state)} · <button class="btn link" data-action="go" data-id="foods">设置</button></span>
    </div>
    ${messages(ui)}
    <div class="grid-3 section">${r.meals.map((m) => (m.eaten ? eatenCard(m) : openCard(d, ui, m))).join('')}</div>
    ${fastNote}
    <div class="card section"><div class="eyebrow">指南要点 · ${SOURCES.obesity2024.name}</div>
      <p class="muted small" style="margin:8px 0 0">上面每份菜单的食材已按推荐的进餐顺序排列。</p>
      ${tipsList(MEAL_RULES)}</div>`;
}
