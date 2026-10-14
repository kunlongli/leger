// 运行：node menu.test.mjs
import assert from 'node:assert/strict';
import { plan, mealTargets, metabolism, DEFAULT_SETTINGS } from './calc.js';
import { FOODS } from './data.js';
import { excludedIds, foodPool, remainingMeals, composeMenus, candidates, recommend, MIN_MEAL_KCAL } from './menu.js';
import { validateSettings, validateFood, validateEatenMeal, validateState } from './store.js';
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

console.log('all menu checks passed');
