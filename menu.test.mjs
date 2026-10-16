// 运行：node menu.test.mjs
import assert from 'node:assert/strict';
import { plan, mealTargets, metabolism, DEFAULT_SETTINGS } from './calc.js';
import { FOODS } from './data.js';
import { excludedIds, foodPool, remainingMeals, composeMenus, candidates, recommend, MIN_MEAL_KCAL } from './menu.js';
import { validateSettings, validateFood, validateEatenMeal, validateState, validateLog, syncIntake, EMPTY_STATE } from './store.js';
import { waistChange, analyze } from './advice.js';
import { esc } from './ui.js';

const byId = (id) => FOODS.find((f) => f.id === id);
const prefs = (p = {}) => ({ groups: [], exclude: [], pantry: [], ...p });

// ---------- 参数可调 ----------
const profile = { sex: 'male', age: 30, height: 175, weight: 90, target: 75, activity: 'moderate', tier: 'standard', fasting: 'none', keepMuscle: false };
const meta = metabolism(profile, []);
const custom = { ...DEFAULT_SETTINGS, deficits: { ...DEFAULT_SETTINGS.deficits, standard: 600 }, proteinPerKg: { normal: 2.0, keepMuscle: 2.2 }, fatPct: 30 };
const p = plan(profile, meta, custom);
assert.equal(p.tier.deficit, 600);
assert.equal(p.macros.protein, Math.round(85 * 2.0)); // min(90, 75+10) × 2.0
assert.equal(p.macros.fat, Math.round((p.intake * 0.3) / 9));
const shares = { ...DEFAULT_SETTINGS, mealShares: { ...DEFAULT_SETTINGS.mealShares, none: { breakfast: 20, lunch: 50, dinner: 30 } } };
assert.deepEqual(mealTargets(2000, 'none', shares).map((m) => m.kcal), [400, 1000, 600]);

// 参数校验：合计不为 100、超范围、缺字段用默认值
assert.ok(validateSettings({ mealShares: { none: { breakfast: 50, lunch: 40, dinner: 30 } } }).error.includes('100'));
assert.ok(validateSettings({ deficits: { hard: 5000 } }).error.includes('困难模式'));
assert.deepEqual(validateSettings(undefined).value, DEFAULT_SETTINGS);
assert.equal(validateSettings({ fatPct: '35' }).value.fatPct, 35);

// ---------- 自定义食材 ----------
const food = validateFood({ name: '  食堂卤鸡腿 ', role: 'protein', kcal: '180', p: '20', c: '2', f: '10' }).value;
assert.equal(food.name, '食堂卤鸡腿');
assert.ok(/^c[a-z0-9]+$/.test(food.id) && food.custom);
assert.ok(validateFood({ name: '', role: 'protein', kcal: 100 }).error);
assert.ok(validateFood({ name: 'x', role: 'meat', kcal: 100 }).error);
assert.ok(validateFood({ name: 'x', role: 'fat', kcal: 900, p: 50, c: 30, f: 30 }).error.includes('100g'));
assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');

// ---------- 忌口过滤 ----------
const noSeafood = foodPool(FOODS, prefs({ groups: ['seafood'], exclude: ['beef'] }));
assert.ok(!noSeafood.some((f) => ['shrimp', 'salmon', 'cod', 'beef'].includes(f.id)));
assert.equal(excludedIds(prefs({ groups: ['vegetarian'] })).has('chicken'), true);
for (const key of ['breakfast', 'lunch', 'dinner', 'snack']) {
  const cands = candidates(key, noSeafood, 'library');
  assert.ok(cands.length >= 3, `${key} 至少 3 套`);
  assert.ok(cands.every((m) => m.foods.every((f) => !['shrimp', 'salmon', 'cod', 'beef'].includes(f.id))), `${key} 不含忌口`);
}
// 素食 + 不吃蛋：菜单库所剩无几，自动组菜补足，仍不含肉
const veg = foodPool(FOODS, prefs({ groups: ['vegetarian', 'egg'] }));
const vegLunch = candidates('lunch', veg, 'library');
assert.ok(vegLunch.length >= 3 && vegLunch.some((m) => m.composed));
assert.ok(vegLunch.every((m) => m.foods.every((f) => !['chicken', 'beef', 'pork', 'duck', 'egg'].includes(f.id))));

// ---------- 冰箱组菜 ----------
const pantry = ['chicken', 'tofu', 'brownrice', 'sweetpotato', 'broccoli', 'spinach', 'tomato'].map(byId);
const composed = composeMenus('dinner', pantry);
assert.ok(composed.length >= 2);
assert.ok(composed.every((m) => m.foods.some((f) => f.role === 'carb') && m.foods.some((f) => f.role === 'protein')));
assert.equal(new Set(composed.map((m) => m.foods.map((f) => f.id).sort().join())).size, composed.length, '组菜不重复');
assert.ok(candidates('lunch', pantry, 'pantry').every((m) => m.foods.every((f) => pantry.includes(f))), '只用冰箱食材');
assert.equal(composeMenus('lunch', [byId('apple')]).length, 0, '食材不足时不硬凑');

// ---------- 按剩余热量 ----------
const meals = mealTargets(1800, 'none'); // 540 / 720 / 540
const none = remainingMeals(meals, {}, 120);
assert.deepEqual(none.meals.map((m) => m.kcal), [540, 720, 540]);
assert.deepEqual(none.meals.map((m) => m.protein), [36, 48, 36]);
// 午餐吃多了：剩余 1800-540-1000=260 全给晚餐
const after = remainingMeals(meals, { breakfast: { kcal: 540, protein: 20 }, lunch: { kcal: 1000, protein: 30 } }, 120);
assert.equal(after.leftKcal, 260);
assert.equal(after.meals[2].kcal, 260);
assert.equal(after.meals[2].protein, 39); // 缺 70g，但 260kcal 最多放 39g 蛋白（60% 热量）
assert.ok(after.meals[0].eaten && after.meals[1].eaten);
// 超出目标：剩余为 0，不再推荐整餐
const over = remainingMeals(meals, { breakfast: { kcal: 900, protein: 20 }, lunch: { kcal: 1200, protein: 30 } }, 120);
assert.equal(over.leftKcal, 0);
assert.deepEqual(recommend(over.meals[2], candidates('dinner', FOODS, 'library')), []);
assert.ok(MIN_MEAL_KCAL > 0);

// 蛋白质缺口大时，排第一的方案蛋白更高
const lowP = recommend({ key: 'lunch', kcal: 600, protein: 15 }, candidates('lunch', FOODS, 'library'));
const highP = recommend({ key: 'lunch', kcal: 600, protein: 60 }, candidates('lunch', FOODS, 'library'));
assert.ok(highP[0].res.total.protein >= lowP[0].res.total.protein);
assert.ok(highP.every((m, i) => i === 0 || m.score >= highP[i - 1].score), '按评分升序');

// ---------- 已吃记录 & 旧数据迁移 ----------
assert.ok(validateEatenMeal({ kcal: '' }).error);
assert.equal(validateEatenMeal({ kcal: '520.4', protein: '' }).value.protein, 0);
const migrated = validateState({ profile: null, logs: [] }).value;
assert.deepEqual(migrated.settings, DEFAULT_SETTINGS);
assert.deepEqual(migrated.prefs, { groups: [], exclude: [], pantry: [] });
assert.deepEqual(validateState({ logs: [], prefs: { groups: ['seafood', 'bogus'], pantry: ['chicken', '<x>'] } }).value.prefs,
  { groups: ['seafood'], exclude: [], pantry: ['chicken'] });

// ---------- 已吃 → 当日摄入 ----------
const D = '2026-10-16';
const withLog = { ...EMPTY_STATE, logs: [{ date: D, morningWeight: 80, eveningWeight: null, sleepStart: null, wake: null, intake: 2500, steps: null, waist: null }] };
const synced = syncIntake({ ...withLog, eaten: { [D]: { breakfast: { kcal: 500, protein: 30, name: 'a' }, lunch: { kcal: 700, protein: 40, name: 'b' } } } }, D);
assert.equal(synced.logs[0].intake, 1200, '覆盖为已吃合计');
assert.equal(synced.logs[0].morningWeight, 80, '其他字段保留');
const fresh = syncIntake({ ...EMPTY_STATE, eaten: { [D]: { lunch: { kcal: 600, protein: 30, name: 'x' } } } }, D);
assert.deepEqual([fresh.logs.length, fresh.logs[0].intake, fresh.logs[0].morningWeight], [1, 600, null], '当天没有记录时新建');
assert.equal(syncIntake({ ...fresh, eaten: { [D]: {} } }, D).logs.length, 0, '全部撤销后删除只剩摄入的记录');
assert.equal(syncIntake({ ...withLog, eaten: { [D]: {} } }, D).logs[0].intake, null, '撤销后有体重的记录保留，摄入清空');
assert.equal(syncIntake(EMPTY_STATE, D), EMPTY_STATE, '无事发生');

// ---------- 腰围 ----------
assert.ok(validateLog({ date: D, waist: '85.5' }).value.waist === 85.5, '只填腰围也可保存');
assert.ok(validateLog({ date: D, waist: '20' }).error.includes('腰围'));
assert.ok(validateLog({ date: D }).error.includes('至少填写'));
const wlog = (date, waist, w) => ({ date, waist, morningWeight: w });
assert.equal(waistChange([wlog('2026-10-01', 90, 80), wlog('2026-10-03', 89, 80)]), null, '间隔不足 7 天');
assert.equal(waistChange([wlog('2026-09-01', 95, 80), wlog('2026-10-01', 90, 80), wlog('2026-10-15', 88.5, 80)]), -1.5, '只看近 3 周');
// 平台期 + 腰围下降 → 首条建议说明脂肪仍在减
const plateauLogs = Array.from({ length: 20 }, (_, i) => ({ date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), morningWeight: 80, waist: i % 7 === 0 ? 90 - i * 0.1 : null }));
const pa = analyze(profile, plateauLogs, metabolism(profile, plateauLogs));
assert.equal(pa.stage.key, 'plateau');
assert.ok(pa.tips[0].includes('腰围减少'), pa.tips[0]);

// ---------- 指南对齐 ----------
const { trainingWeek } = await import('./data.js');
const { GUIDE } = await import('./guide.js');
for (const keepMuscle of [true, false]) {
  const wk = trainingWeek('standard', keepMuscle);
  assert.ok(wk.cardioMinutes >= GUIDE.cardioMinutes[0] && wk.cardioMinutes <= GUIDE.cardioMinutes[1], '有氧分钟在指南区间');
  assert.ok(wk.strengthDays >= GUIDE.strengthDays[0] && wk.strengthDays <= GUIDE.strengthDays[1], '抗阻天数在指南区间');
  const idx = wk.days.map((d, i) => (d.isStrength ? i : -1)).filter((i) => i >= 0);
  assert.ok(idx.every((d, i) => i === 0 || d - idx[i - 1] >= 2), '抗阻隔天');
}
assert.equal(trainingWeek('standard', true).strengthDays, 3);
assert.equal(trainingWeek('standard', false).strengthDays, 2);
const weekly = (perDay) => Array.from({ length: 14 }, (_, i) => ({ date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), morningWeight: +(95 + perDay * i).toFixed(2) }));
const big = { ...profile, target: 70 };
assert.equal(analyze(big, weekly(-1.1 / 7), metabolism(big, weekly(-1.1 / 7))).stage.key, 'fast', '每周 -1.1kg 过快');
assert.equal(analyze(big, weekly(-0.9 / 7), metabolism(big, weekly(-0.9 / 7))).stage.key, 'steady', '每周 -0.9kg 在指南内');

// ---------- 周报 ----------
const { weeklyReport, reportStats } = await import('./report.js');
const dayIso = (i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10); // 10-01 起
const rlogs = Array.from({ length: 14 }, (_, i) => ({
  date: dayIso(i), morningWeight: i < 7 ? 81 : 80, sleepStart: '23:00', wake: i < 7 ? '06:00' : '06:30',
  intake: i < 7 ? 2000 : [1700, 1750, 1500, 1700, 2100, null, 1690][i - 7], steps: 8000,
  waist: i === 3 ? 92 : i === 12 ? 90.5 : null,
}));
const rep = weeklyReport(rlogs, 1700, { stage: { name: '稳定减脂期' }, tips: ['a', 'b', 'c'] }, '2026-10-14');
assert.deepEqual([rep.from, rep.to, rep.loggedDays], ['2026-10-08', '2026-10-14', 7]);
assert.equal(rep.weight, 80);
assert.equal(rep.weightDelta, -1);
assert.equal(rep.sleep, 7.5);
assert.deepEqual([rep.intakeDays, rep.onTarget], [6, 4], '1700/1750/1700/1690 达标，1500 与 2100 超出 ±10%');
assert.equal(rep.waistDelta, -1.5);
assert.deepEqual(rep.tips, ['a', 'b']);
assert.equal(reportStats(rep)[3].label, '腰围变化');
assert.equal(reportStats(rep)[3].value, '−1.5');
const empty = weeklyReport([], 1700, { stage: { name: '起步期' }, tips: [] }, '2026-10-14');
assert.deepEqual([empty.weight, empty.weightDelta, empty.sleep, empty.intakeDays, empty.loggedDays], [null, null, null, 0, 0]);
assert.equal(reportStats(empty)[0].value, '—');

// ---------- 生理期 ----------
const { weightTrend, latestWeight } = await import('./calc.js');
const cycle = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10),
  morningWeight: i >= 11 ? 81.5 : 80 - i * 0.05, // 最后 3 天水肿 +1.5kg
  period: i >= 11,
}));
assert.ok(weightTrend(cycle) < 0, '排除生理期后趋势仍为下降');
assert.ok(weightTrend(cycle.map((l) => ({ ...l, period: false }))) > 0, '不排除会被误判为上升');
assert.equal(latestWeight(profile, cycle), 79.5, '当前体重取最近一个非生理期晨重');
const ca = analyze({ ...profile, sex: 'female' }, cycle, metabolism(profile, cycle));
assert.notEqual(ca.stage.key, 'rebound');
assert.ok(ca.tips[0].includes('生理期'));
assert.ok(validateLog({ date: D, period: 'on' }).value.period === true, '只标生理期也可保存');
assert.equal(validateLog({ date: D, morningWeight: 60 }).value.period, false);

// ---------- 备份提醒 ----------
const { daysSinceBackup } = await import('./store.js');
assert.equal(daysSinceBackup(EMPTY_STATE, D), null);
assert.equal(daysSinceBackup({ ...EMPTY_STATE, logs: [{ date: '2026-10-01' }] }, D), 15, '从未备份：从第一条记录算');
assert.equal(daysSinceBackup({ ...EMPTY_STATE, logs: [{ date: '2026-10-01' }], lastBackup: '2026-10-10' }, D), 6);
assert.equal(validateState({ logs: [], lastBackup: '2026-10-10' }).value.lastBackup, '2026-10-10');
assert.equal(validateState({ logs: [], lastBackup: '<x>' }).value.lastBackup, null);

// ---------- 日历提醒 ----------
const { suggestedTimes, buildIcs } = await import('./reminders.js');
assert.deepEqual(suggestedTimes([]), { evening: '22:30', morning: '07:30' });
const nightsLog = [['23:40', '07:00'], ['00:20', '07:20']].map(([sleepStart, wake], i) => ({ date: `2026-10-0${i + 1}`, sleepStart, wake }));
assert.deepEqual(suggestedTimes(nightsLog), { evening: '23:45', morning: '07:20' }, '跨午夜平均 00:00，提前 15 分钟');
const ics = buildIcs({ evening: '22:45', morning: '07:20' }, '2026-10-16', new Date('2026-10-16T01:02:03Z'));
assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
assert.ok(ics.includes('DTSTART:20261016T224500') && ics.includes('DTSTART:20261016T072000'));
assert.ok(ics.includes('DTSTART:20261018T072000') && ics.includes('RRULE:FREQ=WEEKLY;BYDAY=SU'), '腰围提醒从下一个周日开始');
assert.ok(ics.includes('DTSTAMP:20261016T010203Z'));
assert.ok(!/[^\r]\n/.test(ics), '行尾必须是 CRLF');

// ---------- 离线缓存清单 ----------
const { readFileSync, readdirSync } = await import('node:fs');
const swText = readFileSync(new URL('./sw.js', import.meta.url), 'utf8');
const core = JSON.parse(swText.match(/const CORE = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
const modules = [
  ...readdirSync(new URL('./', import.meta.url)).filter((f) => f.endsWith('.js') && f !== 'sw.js'),
  ...readdirSync(new URL('./views/', import.meta.url)).map((f) => `views/${f}`),
];
assert.deepEqual(modules.filter((m) => !core.includes(m)), [], 'sw.js CORE 漏了模块');

console.log('all menu checks passed');
