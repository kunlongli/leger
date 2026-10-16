// 纯计算模块：不碰 DOM，便于测试（node calc.test.mjs）

export const KCAL_PER_KG = 7700;
export const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55 };
const MIN_INTAKE = { male: 1500, female: 1200 };
const FAST_DAY_KCAL = { male: 600, female: 500 };
const HARD_FLOOR_RATIO = 0.85;
const NIGHT_FACTOR_LIMIT = 0.05; // 夜间代谢指数对 BMR 的最大修正 ±5%
const NIGHT_DAMPING = 0.25;
const KCAL_PER_STEP_PER_KG = 0.0005;
const ADAPTIVE_MIN_DAYS = 10;
const DAY_MS = 86400000;

export const TIERS = [
  { id: 'gentle', name: '温和', desc: '几乎无感，适合刚起步或工作高压期' },
  { id: 'standard', name: '标准', desc: '最推荐的长期节奏' },
  { id: 'active', name: '进阶', desc: '需要稳定运动配合，适合执行力强的阶段' },
  { id: 'hard', name: '困难模式', desc: '短期冲刺，摄入可低于基础代谢，建议不超过 4 周' },
];

export const MEAL_NAMES = { breakfast: '早餐', lunch: '午餐', snack: '加餐', dinner: '晚餐' };

export const FASTING = {
  none: { name: '常规三餐', meals: [['breakfast', '07:30'], ['lunch', '12:00'], ['dinner', '18:30']] },
  '16:8': { name: '轻断食 16:8', window: '12:00 – 20:00', meals: [['lunch', '12:00'], ['snack', '16:00'], ['dinner', '19:30']] },
  '5:2': { name: '轻断食 5:2', meals: [['breakfast', '07:30'], ['lunch', '12:00'], ['dinner', '18:30']] },
};

// 可在「方案 · 高级参数」中调整的参数
export const DEFAULT_SETTINGS = {
  deficits: { gentle: 300, standard: 500, active: 750, hard: 1000 },
  mealShares: {
    none: { breakfast: 30, lunch: 40, dinner: 30 },
    '16:8': { lunch: 45, snack: 15, dinner: 40 },
    '5:2': { breakfast: 30, lunch: 40, dinner: 30 },
  },
  proteinPerKg: { normal: 1.2, keepMuscle: 1.8 },
  fatPct: 27,
};

const sum = (a) => a.reduce((s, x) => s + x, 0);
const mean = (a) => sum(a) / a.length;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const roundTo = (x, step) => Math.round(x / step) * step;
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const dayNum = (date) => Math.round(Date.parse(date) / DAY_MS);
export const sortByDate = (logs) => [...logs].sort((a, b) => a.date.localeCompare(b.date));
// 生理期前后水分波动大，这些天不参与趋势、代谢校准与当前体重
export const steady = (logs) => logs.filter((l) => !l.period);

// Katch-McArdle（有体脂率时更准），否则 Mifflin-St Jeor
export function bmr({ sex, age, height, weight, bodyFat }) {
  if (bodyFat) return 370 + 21.6 * weight * (1 - bodyFat / 100);
  return 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
}

export function sleepHours(sleepStart, wake) {
  const toMin = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const diff = toMin(wake) - toMin(sleepStart);
  return (diff <= 0 ? diff + 1440 : diff) / 60;
}

// 睡眠期间每小时掉秤克数（静息代谢 + 呼吸/皮肤失水）
export function nightRate(log) {
  if (!log.eveningWeight || !log.morningWeight || !log.sleepStart || !log.wake) return null;
  const hours = sleepHours(log.sleepStart, log.wake);
  return ((log.eveningWeight - log.morningWeight) * 1000) / hours;
}

// 近 3 天夜间掉秤速率 vs 个人基线（此前最多 14 天中位数）
export function nightIndex(logs) {
  const rates = sortByDate(steady(logs)).map(nightRate).filter((r) => r != null && r > 0);
  if (rates.length < 6) return { factor: 1, recent: null, baseline: null, ratio: null };
  const recent = mean(rates.slice(-3));
  const baseline = median(rates.slice(0, -3).slice(-14));
  const ratio = recent / baseline;
  const factor = 1 + clamp((ratio - 1) * NIGHT_DAMPING, -NIGHT_FACTOR_LIMIT, NIGHT_FACTOR_LIMIT);
  return { factor, recent, baseline, ratio };
}

function slope(points) {
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  const num = sum(points.map((p) => (p.x - mx) * (p.y - my)));
  const den = sum(points.map((p) => (p.x - mx) ** 2));
  return den === 0 ? 0 : num / den;
}

function recentWeighed(logs, days) {
  const pts = sortByDate(steady(logs)).filter((l) => l.morningWeight);
  if (!pts.length) return [];
  const last = dayNum(pts.at(-1).date);
  return pts.filter((p) => last - dayNum(p.date) < days);
}

// kg/天，负数为下降
export function weightTrend(logs, days = 14) {
  const win = recentWeighed(logs, days);
  if (win.length < 3) return null;
  return slope(win.map((p) => ({ x: dayNum(p.date), y: p.morningWeight })));
}

// 用真实摄入 + 体重变化反推 TDEE，与公式值各占一半
export function adaptiveTdee(logs, formulaTdee) {
  const win = recentWeighed(logs, 14).filter((l) => l.intake);
  if (win.length < ADAPTIVE_MIN_DAYS) return null;
  const trend = weightTrend(logs, 14);
  const observed = mean(win.map((l) => l.intake)) - trend * KCAL_PER_KG;
  const bounded = clamp(observed, formulaTdee * 0.75, formulaTdee * 1.25);
  return (formulaTdee + bounded) / 2;
}

export function latestWeight(profile, logs) {
  const last = sortByDate(steady(logs)).filter((l) => l.morningWeight).at(-1);
  return last ? last.morningWeight : profile.weight;
}

export function metabolism(profile, logs) {
  const weight = latestWeight(profile, logs);
  const base = bmr({ ...profile, weight });
  const night = nightIndex(logs);
  const bmrAdj = base * night.factor;
  const formulaTdee = bmrAdj * ACTIVITY_FACTORS[profile.activity];
  const adaptive = adaptiveTdee(logs, formulaTdee);
  return {
    weight,
    bmrFormula: Math.round(base),
    bmr: Math.round(bmrAdj),
    tdee: Math.round(adaptive ?? formulaTdee),
    isAdaptive: adaptive != null,
    night,
  };
}

function macros(intake, weight, target, keepMuscle, settings) {
  const proteinBase = Math.min(weight, target + 10);
  const protein = Math.round(proteinBase * settings.proteinPerKg[keepMuscle ? 'keepMuscle' : 'normal']);
  const fat = Math.round((intake * settings.fatPct) / 100 / 9);
  const carbs = Math.max(0, Math.round((intake - protein * 4 - fat * 9) / 4));
  return { protein, fat, carbs };
}

export function plan(profile, meta, settings = DEFAULT_SETTINGS) {
  const base = TIERS.find((t) => t.id === profile.tier) ?? TIERS[1];
  const tier = { ...base, deficit: settings.deficits[base.id] };
  const minIntake = MIN_INTAKE[profile.sex];
  const floor = tier.id === 'hard'
    ? Math.max(minIntake, meta.bmr * HARD_FLOOR_RATIO)
    : Math.max(minIntake, meta.bmr);
  const intake = Math.round(Math.max(meta.tdee - tier.deficit, floor));
  const dietDeficit = Math.max(meta.tdee - intake, 0);
  const exerciseKcal = Math.max(tier.deficit - dietDeficit, 0);
  const extraSteps = roundTo(exerciseKcal / (KCAL_PER_STEP_PER_KG * meta.weight), 500);
  const fastDay = profile.fasting === '5:2'
    ? { fastKcal: FAST_DAY_KCAL[profile.sex], normalKcal: Math.round(Math.min(meta.tdee, (intake * 7 - 2 * FAST_DAY_KCAL[profile.sex]) / 5)) }
    : null;
  return {
    tier,
    intake,
    dietDeficit,
    exerciseKcal,
    extraSteps,
    weeklyLossKg: (tier.deficit * 7) / KCAL_PER_KG,
    belowBmr: intake < meta.bmr,
    macros: macros(intake, meta.weight, profile.target, profile.keepMuscle, settings),
    fastDay,
  };
}

export function mealTargets(intake, fasting, settings = DEFAULT_SETTINGS) {
  const shares = settings.mealShares[fasting];
  return FASTING[fasting].meals.map(([key, time]) => ({
    key, time, name: MEAL_NAMES[key], share: shares[key] / 100, kcal: Math.round((intake * shares[key]) / 100),
  }));
}

const ROLE_SHARE = { protein: 0.4, carb: 0.4, veg: 0.1, fat: 0.1, dairy: 0.25, fruit: 0.1 };
const VEG_MAX_G = 300;

// 按角色分配热量，再按每 100g 热量换算克数（取整到 5g）
export function portion(foods, kcal) {
  if (!foods.length) return { items: [], total: { kcal: 0, protein: 0, carbs: 0, fat: 0 } };
  const roles = [...new Set(foods.map((f) => f.role))];
  const shareSum = sum(roles.map((r) => ROLE_SHARE[r]));
  const items = foods.map((f) => {
    const sameRole = foods.filter((x) => x.role === f.role).length;
    const foodKcal = (kcal * ROLE_SHARE[f.role]) / shareSum / sameRole;
    const raw = Math.max(5, roundTo((foodKcal / f.kcal) * 100, 5));
    const grams = f.role === 'veg' ? Math.min(raw, VEG_MAX_G) : raw;
    const k = grams / 100;
    return { ...f, grams, kcalOut: Math.round(f.kcal * k), p: f.p * k, c: f.c * k, fa: f.f * k };
  });
  const total = {
    kcal: Math.round(sum(items.map((i) => i.kcalOut))),
    protein: Math.round(sum(items.map((i) => i.p))),
    carbs: Math.round(sum(items.map((i) => i.c))),
    fat: Math.round(sum(items.map((i) => i.fa))),
  };
  return { items, total };
}

export function movingAverage(points, window = 7) {
  return points.map((p) => {
    const win = points.filter((q) => q.x <= p.x && q.x > p.x - window);
    return { x: p.x, y: mean(win.map((q) => q.y)) };
  });
}
