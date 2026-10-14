// 方案页：档位 / 断食模式 / 保肌 / 高级参数
import { TIERS, FASTING, MEAL_NAMES, KCAL_PER_KG } from '../calc.js';
import { DESK_ROUTINE, trainingWeek } from '../data.js';
import { fmt, field, messages, tipsList, etaText } from '../ui.js';

function tierCards(current, deficits) {
  return `<div class="tiers">${TIERS.map((t) => `
    <button class="tier ${t.id === current ? 'active' : ''}" data-action="set-tier" data-id="${t.id}">
      <div class="eyebrow ${t.id === current ? 'muted' : ''}">${t.name}</div>
      <div class="num">−${deficits[t.id]}</div>
      <div class="muted small">kcal / 日 · 约 ${fmt((deficits[t.id] * 7) / KCAL_PER_KG, 2)} kg / 周</div>
      <div class="desc muted">${t.desc}</div>
    </button>`).join('')}</div>`;
}

function ledgerCard(profile, meta, pl) {
  const remaining = meta.weight - profile.target;
  const dietPct = (pl.dietDeficit / pl.tier.deficit) * 100;
  const fastingNote = profile.fasting === '16:8'
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

function macroCard(profile, settings, pl) {
  const { protein, fat, carbs } = pl.macros;
  const factor = settings.proteinPerKg[profile.keepMuscle ? 'keepMuscle' : 'normal'];
  const row = (name, g, k, note) => `<tr><td>${name}<div class="muted small">${note}</div></td><td class="num">${g} g</td><td class="num muted">${g * k} kcal</td></tr>`;
  return `<div class="card"><div class="eyebrow">宏量营养</div><h2 style="margin-top:12px">每日 ${pl.intake} kcal</h2>
    <table><tbody>
      ${row('蛋白质', protein, 4, `${profile.keepMuscle ? '保肌模式 ' : ''}${factor} g/kg`)}
      ${row('脂肪', fat, 9, `约 ${settings.fatPct}% 热量`)}
      ${row('碳水', carbs, 4, '其余热量，优先粗粮')}
    </tbody></table></div>`;
}

function trainingSection(profile) {
  if (!profile.keepMuscle) return '<div class="section"><div class="empty">开启「保持肌肉量」后生成每周力量训练计划</div></div>';
  return `<div class="section"><div class="eyebrow">Training</div><h2>保肌训练周计划</h2>
    <div class="grid-3">${trainingWeek(profile.tier).map((day) => `
      <div class="meal"><div class="eyebrow">${day.day}</div><div class="dish" style="margin-top:6px">${day.focus}</div>
        <ul class="portion-list">${day.items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`).join('')}
    </div></div>`;
}

const num = (name, label, value, attrs) => field(name, label, `type="number" required value="${value}" ${attrs}`);

function settingsForm(settings, ui) {
  const shareRows = Object.entries(settings.mealShares).map(([mode, shares]) => `
    <div class="eyebrow" style="margin:28px 0 4px">${FASTING[mode].name} · 餐次占比 %（合计 100）</div>
    <div class="form">${Object.entries(shares).map(([k, v]) => num(`mealShares.${mode}.${k}`, MEAL_NAMES[k], v, 'min="0" max="100" step="1"')).join('')}</div>`).join('');
  return `<details class="advanced section" ${ui.settingsOpen ? 'open' : ''}>
    <summary data-action="toggle-settings"><span class="eyebrow">Advanced</span>　高级参数</summary>
    <form id="settings-form">
      <div class="eyebrow" style="margin:24px 0 4px">各档每日缺口 KCAL</div>
      <div class="form">${TIERS.map((t) => num(`deficits.${t.id}`, t.name, settings.deficits[t.id], 'min="100" max="1500" step="50"')).join('')}</div>
      <div class="eyebrow" style="margin:28px 0 4px">宏量营养</div>
      <div class="form">
        ${num('proteinPerKg.normal', '常规蛋白质 G/KG', settings.proteinPerKg.normal, 'min="0.8" max="2.5" step="0.1"')}
        ${num('proteinPerKg.keepMuscle', '保肌蛋白质 G/KG', settings.proteinPerKg.keepMuscle, 'min="0.8" max="2.5" step="0.1"')}
        ${num('fatPct', '脂肪热量占比 %', settings.fatPct, 'min="15" max="40" step="1"')}
      </div>
      ${shareRows}
    </form>
    <div class="actions"><button class="btn" form="settings-form">保存参数</button>
      <button class="btn ghost" data-action="reset-settings">恢复默认</button></div>
    ${ui.settingsOpen ? messages(ui) : ''}
  </details>`;
}

export function viewPlan({ state, ui, d }) {
  const p = state.profile;
  return `
    <div class="eyebrow">Programme</div><h1>减重方案</h1>
    <p class="lede">选择档位与饮食模式。系统每天根据最新体重与夜间代谢重新计算以下所有数字；具体参数可在页底「高级参数」中调整。</p>
    ${tierCards(p.tier, state.settings.deficits)}
    <div class="actions" style="justify-content:space-between">
      <div class="segmented">${Object.entries(FASTING).map(([k, v]) => `<button data-action="set-fasting" data-id="${k}" class="${k === p.fasting ? 'active' : ''}">${v.name}</button>`).join('')}</div>
      <label class="toggle"><input type="checkbox" id="keep-muscle" ${p.keepMuscle ? 'checked' : ''}> 保持肌肉量</label>
    </div>
    <div class="grid-2 section">${ledgerCard(p, d.meta, d.plan)}${macroCard(p, state.settings, d.plan)}</div>
    ${trainingSection(p)}
    <div class="section"><div class="eyebrow">At the Desk</div><h2>久坐微运动</h2>${tipsList(DESK_ROUTINE)}</div>
    ${settingsForm(state.settings, ui)}`;
}
