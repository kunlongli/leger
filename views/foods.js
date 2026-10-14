// 食材页：忌口偏好 / 冰箱里有什么 / 自选份量规划 / 我的食材库
import { portion } from '../calc.js';
import { ROLE_NAMES, PREF_GROUPS } from '../data.js';
import { excludedIds } from '../menu.js';
import { esc, fmt, field, select, messages, chip, portionList } from '../ui.js';

const byRole = (foods, render) => Object.entries(ROLE_NAMES).map(([role, name]) => {
  const list = foods.filter((f) => f.role === role);
  return list.length ? `<div class="eyebrow" style="margin-top:14px">${name}</div><div class="chips">${list.map(render).join('')}</div>` : '';
}).join('');

function prefsSection(state, allFoods) {
  const groupExcluded = new Set(state.prefs.groups.flatMap((g) => PREF_GROUPS[g].foods));
  const groups = Object.entries(PREF_GROUPS).map(([k, g]) => chip(g.name, state.prefs.groups.includes(k), 'toggle-group', `data-id="${k}"`)).join('');
  const singles = byRole(allFoods, (f) => (groupExcluded.has(f.id)
    ? `<button class="chip off" disabled title="已被饮食偏好排除">${esc(f.name)}</button>`
    : `<button class="chip ${state.prefs.exclude.includes(f.id) ? 'off' : ''}" data-action="toggle-exclude" data-id="${f.id}">${esc(f.name)}</button>`));
  return `<div class="section"><div class="eyebrow">Preferences</div><h2>忌口与偏好</h2>
    <p class="muted small">选中的饮食偏好与单独排除的食材，推荐菜单与冰箱组菜都会避开。</p>
    <div class="chips">${groups}</div>
    <details class="advanced" style="margin-top:8px" ${state.prefs.exclude.length ? 'open' : ''}>
      <summary><span class="eyebrow">Exclude</span>　单独排除某些食材（点一下划掉）</summary>${singles}</details>
  </div>`;
}

function pantrySection(state, pool) {
  const chips = byRole(pool, (f) => chip(f.name, state.prefs.pantry.includes(f.id), 'toggle-pantry', `data-id="${f.id}"`));
  const count = pool.filter((f) => state.prefs.pantry.includes(f.id)).length;
  return `<div class="section"><div class="eyebrow">Pantry</div><h2>冰箱里有什么</h2>
    <p class="muted small">勾选手边有的食材，在「膳食」页切换到「冰箱食材组菜」，系统按每餐热量自动搭配并给出克数。建议至少各选一样主食、蛋白质和蔬菜。</p>
    ${chips}
    <div class="actions" style="margin-top:8px"><span class="muted small">已选 ${count} 样</span>
      ${count ? '<button class="btn link" data-action="clear-pantry">清空</button>' : ''}
      <button class="btn ghost" data-action="go-pantry">去组菜</button></div>
  </div>`;
}

function builder(ui, d) {
  const meal = d.meals.find((m) => m.key === ui.meal) ?? d.meals[0];
  const picked = ui.picks.map((id) => d.foodById.get(id)).filter(Boolean);
  const chips = byRole(d.allFoods, (f) => chip(f.name, ui.picks.includes(f.id), 'toggle-food', `data-id="${f.id}"`));
  return `<div class="section"><div class="eyebrow">Compose</div><h2>自选食材 · 份量规划</h2>
    <p class="muted small">选好一餐的食材，按该餐热量自动计算克数（米饭、面类为熟重，其余为生重）。</p>
    <div class="segmented" style="margin:8px 0 12px">${d.meals.map((m) => `<button data-action="set-meal" data-id="${m.key}" class="${m.key === meal.key ? 'active' : ''}">${m.name} ${m.kcal}</button>`).join('')}</div>
    <div class="grid-2"><div>${chips}</div>
      <div class="card"><div class="eyebrow">${meal.name} · 目标 ${meal.kcal} kcal</div>
        ${picked.length ? portionList(portion(picked, meal.kcal)) : '<p class="muted">从左侧选择食材</p>'}
        ${picked.length ? '<button class="btn link" data-action="clear-picks">清空选择</button>' : ''}
      </div></div></div>`;
}

function customSection(state, ui) {
  const rows = state.customFoods.map((f) => `<tr>
    <td>${esc(f.name)}</td><td>${ROLE_NAMES[f.role]}</td><td class="num">${fmt(f.kcal)}</td>
    <td class="num">${fmt(f.p, 1)}</td><td class="num">${fmt(f.c, 1)}</td><td class="num">${fmt(f.f, 1)}</td>
    <td class="num"><button class="btn link" data-action="delete-food" data-id="${f.id}">删除</button></td></tr>`).join('');
  return `<div class="section"><div class="eyebrow">My Foods</div><h2>我的食材库</h2>
    <p class="muted small">食堂菜、常吃的外卖单品都可以录进来，数值看包装营养成分表或按每 100g 估算。录入后可在推荐、组菜、份量规划中使用。</p>
    <form id="food-form" class="form">
      ${field('name', '名称', 'type="text" maxlength="20" required placeholder="如：公司食堂卤鸡腿"')}
      ${select('role', '类别', ROLE_NAMES, 'protein')}
      ${field('kcal', '每 100G 热量 KCAL', 'type="number" step="1" min="1" max="900" required')}
      ${field('p', '蛋白质 G', 'type="number" step="0.1" min="0" max="100"')}
      ${field('c', '碳水 G', 'type="number" step="0.1" min="0" max="100"')}
      ${field('f', '脂肪 G', 'type="number" step="0.1" min="0" max="100"')}
    </form>
    <div class="actions"><button class="btn" form="food-form">添加食材</button></div>
    ${messages(ui)}
    <div class="table-wrap" style="margin-top:24px">${rows ? `<table>
      <thead><tr><th>名称</th><th>类别</th><th class="num">KCAL</th><th class="num">蛋白</th><th class="num">碳水</th><th class="num">脂肪</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table>` : '<div class="empty">还没有自定义食材</div>'}</div>
  </div>`;
}

export function viewFoods({ state, ui, d }) {
  const ex = excludedIds(state.prefs);
  return `
    <div class="eyebrow">Ingredients</div><h1>食材</h1>
    <p class="lede">设置忌口、告诉系统冰箱里有什么，或者录入你常吃的食物。</p>
    ${prefsSection(state, d.allFoods)}
    ${pantrySection(state, d.allFoods.filter((f) => !ex.has(f.id)))}
    ${builder(ui, d)}
    ${customSection(state, ui)}`;
}
