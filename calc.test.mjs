// 运行：node calc.test.mjs
import assert from 'node:assert/strict';
import { bmr, sleepHours, nightRate, nightIndex, weightTrend, metabolism, plan, portion, mealTargets } from './calc.js';
import { analyze } from './advice.js';
import { FOODS } from './data.js';

const profile = { sex: 'male', age: 30, height: 175, weight: 80, target: 70, activity: 'sedentary', tier: 'standard', fasting: 'none', keepMuscle: true };
const day = (i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
const series = (n, start, perDay, extra = () => ({})) =>
  Array.from({ length: n }, (_, i) => ({ date: day(i), morningWeight: +(start + perDay * i).toFixed(2), ...extra(i) }));

// BMR：Mifflin 男 80kg/175cm/30 岁 = 800+1093.75-150+5
assert.equal(bmr(profile), 1748.75);
// Katch-McArdle 优先
assert.equal(Math.round(bmr({ ...profile, bodyFat: 25 })), Math.round(370 + 21.6 * 60));

// 跨午夜睡眠
assert.equal(sleepHours('23:30', '07:00'), 7.5);
assert.equal(sleepHours('01:00', '07:00'), 6);
assert.equal(nightRate({ eveningWeight: 80.6, morningWeight: 80.0, sleepStart: '23:00', wake: '07:00' }).toFixed(1), '75.0');

// 夜间代谢指数：数据不足 → 1；最近三晚掉得多 → >1 且受上限约束
assert.equal(nightIndex([]).factor, 1);
const nights = Array.from({ length: 10 }, (_, i) => ({
  date: day(i), eveningWeight: 80.5 + (i >= 7 ? 0.5 : 0), morningWeight: 80, sleepStart: '23:00', wake: '07:00',
}));
const ni = nightIndex(nights);
assert.ok(ni.factor > 1 && ni.factor <= 1.05, `factor ${ni.factor}`);

// 趋势斜率
assert.ok(Math.abs(weightTrend(series(14, 80, -0.1)) + 0.1) < 1e-9);

// 方案：久坐 TDEE≈2099，标准档 500 → 1599 ≥ BMR 1749? 否 → 被 BMR 托底，剩余缺口靠运动
const meta = metabolism(profile, []);
assert.equal(meta.tdee, Math.round(1748.75 * 1.2));
const p = plan(profile, meta);
assert.equal(p.intake, meta.bmr);
assert.equal(p.dietDeficit + p.exerciseKcal, 500);
assert.ok(p.extraSteps > 0);
// 困难模式允许低于 BMR，但不低于男性 1500
const hard = plan({ ...profile, tier: 'hard' }, meta);
assert.ok(hard.belowBmr && hard.intake >= 1500);
// 5:2
const f52 = plan({ ...profile, fasting: '5:2' }, meta);
assert.equal(f52.fastDay.fastKcal, 600);
assert.ok(f52.fastDay.normalKcal <= meta.tdee);

// 三餐占比合计 100%
for (const mode of ['none', '16:8', '5:2']) {
  const meals = mealTargets(2000, mode);
  assert.ok(Math.abs(meals.reduce((s, m) => s + m.kcal, 0) - 2000) <= 2, mode);
}

// 份量：总热量接近目标（取整误差 <8%），蔬菜有上限
const pick = ['chicken', 'brownrice', 'broccoli', 'olive'].map((id) => FOODS.find((f) => f.id === id));
const por = portion(pick, 600);
assert.ok(Math.abs(por.total.kcal - 600) / 600 < 0.08, `portion ${por.total.kcal}`);
assert.ok(por.items.find((i) => i.id === 'broccoli').grams <= 300);
assert.equal(portion([], 500).items.length, 0);

// 阶段分析
const start = analyze(profile, series(3, 80, -0.1), metabolism(profile, series(3, 80, -0.1)));
assert.equal(start.stage.key, 'start');
const fastLogs = series(14, 90, -0.2); // 每周 -1.4kg / ~88kg > 1%
assert.equal(analyze({ ...profile, target: 70 }, fastLogs, metabolism(profile, fastLogs)).stage.key, 'fast');
const flat = series(20, 80, 0.005);
assert.equal(analyze(profile, flat, metabolism(profile, flat)).stage.key, 'plateau');
const steady = series(20, 80, -0.07);
assert.equal(analyze(profile, steady, metabolism(profile, steady)).stage.key, 'steady');
const up = series(14, 80, 0.05);
assert.equal(analyze(profile, up, metabolism(profile, up)).stage.key, 'rebound');
const done = series(8, 70.5, -0.1);
assert.equal(analyze(profile, done, metabolism(profile, done)).stage.key, 'maintain');

// 自适应 TDEE：吃 2000、每天掉 0.1kg → 观测 2770，被上限 1.25×公式 截断后与公式平均
const adaptLogs = series(14, 80, -0.1, () => ({ intake: 2000 }));
const am = metabolism(profile, adaptLogs);
assert.ok(am.isAdaptive);
assert.ok(am.tdee > Math.round(bmr({ ...profile, weight: 78.7 }) * 1.2));

console.log('all checks passed');
