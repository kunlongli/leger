// 视图公共工具。用户输入的文字（自定义食材名、餐名）一律经 esc() 再进 innerHTML
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

export const fmt = (n, d = 0) => (n == null ? '—' : Number(n).toFixed(d));
export const longDate = (d = new Date()) => d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
export const attr = (v) => (v == null ? '' : `value="${esc(v)}"`);

export const field = (name, label, attrs = '', hint = '') => `
  <div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;

export const select = (name, label, options, current) => `
  <div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">
    ${Object.entries(options).map(([k, v]) => `<option value="${k}" ${k === current ? 'selected' : ''}>${v}</option>`).join('')}
  </select></div>`;

export const messages = (ui) => `<div class="error">${esc(ui.error)}</div>${ui.flash ? `<div class="flash">${esc(ui.flash)}</div>` : ''}`;
export const kpi = (label, num, unit, note) => `<div class="kpi"><div class="eyebrow">${label}</div><div class="num">${num}<small>${unit}</small></div><div class="note">${note}</div></div>`;
export const bigNum = (n, unit) => `<div style="font:300 34px/1.1 var(--serif)">${n}<small class="muted" style="font-size:14px"> ${unit}</small></div>`;
export const tipsList = (items) => `<ul class="tips">${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;
export const chip = (label, on, action, data = '') => `<button class="chip ${on ? 'on' : ''}" data-action="${action}" ${data}>${esc(label)}</button>`;

export const portionList = (res) => `<ul class="portion-list">${res.items.map((i) => `<li><span>${esc(i.name)}</span><span>${i.grams} g <span class="muted">· ${i.kcalOut} kcal</span></span></li>`).join('')}</ul>
  <p class="muted small">合计 ${res.total.kcal} kcal · 蛋白 ${res.total.protein}g · 碳水 ${res.total.carbs}g · 脂肪 ${res.total.fat}g</p>`;

export function etaText(remaining, weeklyKg) {
  if (remaining <= 0) return '已达成';
  const d = new Date();
  d.setDate(d.getDate() + Math.ceil((remaining / weeklyKg) * 7));
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}
