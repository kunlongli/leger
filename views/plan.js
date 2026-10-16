// 方案页：档位 / 断食模式 / 保肌 / 高级参数
import { TIERS, FASTING, MEAL_NAMES, KCAL_PER_KG } from '../calc.js';
import { DESK_ROUTINE, trainingWeek } from '../data.js';
import { fmt, field, messages, tipsList, etaText, esc } from '../ui.js';
import { GUIDE, SOURCES, BASIS } from '../guide.js';

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
  const pct = (g, k) => Math.round((g * k * 100) / pl.intake);
  const range = ([lo, hi], v) => `<span class="${v < lo || v > hi ? 'gold' : 'muted'}">指南 ${lo}–${hi}%</span>`;
  const row = (name, g, k, note, guide) => `<tr><td>${name}<div class="muted small">${note}</div></td><td class="num">${g} g</td>
    <td class="num">${pct(g, k)}%<div class="small">${range(guide, pct(g, k))}</div></td></tr>`;
  const highProtein = pct(protein, 4) > GUIDE.macroPct.protein[1];
  return `<div class="card"><div class="eyebrow">宏量营养 · 供能比</div><h2 style="margin-top:12px">每日 ${pl.intake} kcal</h2>
    <table><tbody>
      ${row('蛋白质', protein, 4, `${profile.keepMuscle ? '保肌模式 ' : ''}${factor} g/kg`, GUIDE.macroPct.protein)}
      ${row('脂肪', fat, 9, `设定 ${settings.fatPct}% 热量`, GUIDE.macroPct.fat)}
      ${row('碳水', carbs, 4, '其余热量，优先粗粮', GUIDE.macroPct.carbs)}
    </tbody></table>
    ${highProtein ? `<p class="small muted">蛋白质占比高于常规区间，属于指南认可的「高蛋白膳食」模式：限能量时有助于保住肌肉${profile.keepMuscle ? '（ISSN：有运动者 1.4–2.0 g/kg）' : ''}。</p>` : ''}
  </div>`;
}

function sixMonthCard(profile, meta, pl) {
  const [lo, hi] = GUIDE.sixMonthLossPct;
  const planned = Math.min(pl.weeklyLossKg * 26, Math.max(0, meta.weight - profile.target));
  const plannedPct = (planned / meta.weight) * 100;
  const verdict = plannedPct > hi
    ? '<span class="gold">按当前档位推算超过指南上限，建议困难模式只用于短期冲刺。</span>'
    : plannedPct < lo ? '低于指南的理想区间，节奏偏保守，可考虑上调一档。' : '在指南推荐区间内。';
  return `<div class="card"><div class="eyebrow">6 个月目标 · 指南参照</div>
    <h2 style="margin-top:12px">−${fmt((meta.weight * lo) / 100, 1)} ~ −${fmt((meta.weight * hi) / 100, 1)} kg</h2>
    <p class="muted small">《成人肥胖食养指南》建议 6 个月内减当前体重的 ${lo}–${hi}%，每月 ${GUIDE.monthlyLossKg.join('–')}kg。</p>
    <table><tbody>
      <tr><td>按当前方案 6 个月</td><td class="num">−${fmt(planned, 1)} kg（${fmt(plannedPct, 1)}%）</td></tr>
    </tbody></table>
    <p class="small">${verdict}</p></div>`;
}

function trainingSection(profile) {
  const week = trainingWeek(profile.tier, profile.keepMuscle);
  const [cLo, cHi] = GUIDE.cardioMinutes;
  const [sLo, sHi] = GUIDE.strengthDays;
  return `<div class="section"><div class="eyebrow">Training</div><h2>运动周计划</h2>
    <p class="muted small">每周有氧 ${week.cardioMinutes} 分钟（指南 ${cLo}–${cHi}）· 抗阻 ${week.strengthDays} 天、隔天进行（指南 ${sLo}–${sHi} 天）。
      ${profile.keepMuscle ? '已开启保肌：抗阻 3 天。' : '开启「保持肌肉量」可增加到 3 天抗阻并提高蛋白质。'}</p>
    <div class="grid-3">${week.days.map((day) => `
      <div class="meal"><div class="eyebrow">${day.day}</div><div class="dish" style="margin-top:6px">${day.focus}</div>
        <ul class="portion-list">${day.items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`).join('')}
    </div></div>`;
}

function basisSection() {
  const sourceLink = (key) => {
    const s = SOURCES[key];
    return `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`;
  };
  return `<div class="section"><div class="eyebrow">Evidence</div><h2>理论依据</h2>
    <p class="muted small">方案中的数字均来自以下指南；括号内为出处。</p>
    <ul class="tips basis">${BASIS.map((b) => `<li>${b.rule}<div class="muted small">${b.src ? sourceLink(b.src) : '本应用估算方法'}</div></li>`).join('')}</ul>
    <p class="muted small">${Object.values(SOURCES).map((s) => `${esc(s.name)} · ${esc(s.org)}`).join('<br>')}</p>
  </div>`;
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
    <p class="lede">依据国家卫健委《成人肥胖食养指南（2024年版）》等制定（见页底「理论依据」）。系统每天根据最新体重与夜间代谢重新计算以下数字，参数可在「高级参数」中调整。</p>
    ${tierCards(p.tier, state.settings.deficits)}
    <div class="actions" style="justify-content:space-between">
      <div class="segmented">${Object.entries(FASTING).map(([k, v]) => `<button data-action="set-fasting" data-id="${k}" class="${k === p.fasting ? 'active' : ''}">${v.name}</button>`).join('')}</div>
      <label class="toggle"><input type="checkbox" id="keep-muscle" ${p.keepMuscle ? 'checked' : ''}> 保持肌肉量</label>
    </div>
    <div class="grid-2 section">${ledgerCard(p, d.meta, d.plan)}${macroCard(p, state.settings, d.plan)}</div>
    <div class="grid-2 section">${sixMonthCard(p, d.meta, d.plan)}<div class="card"><div class="eyebrow">At the Desk</div><h2 style="margin-top:12px">久坐微运动</h2>${tipsList(DESK_ROUTINE)}</div></div>
    ${trainingSection(p)}
    ${basisSection()}
    ${settingsForm(state.settings, ui)}`;
}
