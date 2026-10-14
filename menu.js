// 推荐菜单：忌口过滤 → 剩余热量重分配 → 候选（菜单库 / 冰箱组菜）→ 按蛋白质缺口排序
import { portion } from './calc.js';
import { MENUS, PREF_GROUPS } from './data.js';

export const MIN_MEAL_KCAL = 150; // 低于这个热量不再推荐整餐
const MAX_COMPOSED = 8;
const MIN_LIBRARY = 3; // 菜单库过滤后不足 3 套时，用剩余食材自动组菜补足
const KCAL_WEIGHT = 1 / 20; // 评分：热量偏差 20kcal ≈ 蛋白偏差 1g
const MAX_PROTEIN_KCAL_RATIO = 0.6; // 一餐蛋白质热量最多占 60%，否则目标不可能达成

const sum = (a) => a.reduce((s, x) => s + x, 0);

export function excludedIds(prefs) {
  return new Set([...prefs.groups.flatMap((g) => PREF_GROUPS[g]?.foods ?? []), ...prefs.exclude]);
}

export function foodPool(foods, prefs) {
  const ex = excludedIds(prefs);
  return foods.filter((f) => !ex.has(f.id));
}

function openMeal(meal, kcal, protein) {
  const cap = (kcal * MAX_PROTEIN_KCAL_RATIO) / 4;
  return { ...meal, kcal: Math.round(kcal), protein: Math.round(Math.min(protein, cap)) };
}

// 已吃的餐按实际记录，未吃的餐按原占比分摊剩余热量与蛋白质
export function remainingMeals(meals, eaten, proteinTotal) {
  const done = meals.filter((m) => eaten[m.key]).map((m) => eaten[m.key]);
  const eatenKcal = sum(done.map((e) => e.kcal));
  const eatenProtein = sum(done.map((e) => e.protein));
  const leftKcal = Math.max(0, sum(meals.map((m) => m.kcal)) - eatenKcal);
  const leftProtein = Math.max(0, proteinTotal - eatenProtein);
  const openShare = sum(meals.filter((m) => !eaten[m.key]).map((m) => m.share)) || 1;
  return {
    eatenKcal,
    eatenProtein,
    leftKcal,
    leftProtein,
    meals: meals.map((m) => (eaten[m.key]
      ? { ...m, eaten: eaten[m.key] }
      : openMeal(m, (leftKcal * m.share) / openShare, (leftProtein * m.share) / openShare))),
  };
}

// 每个槽位从允许的角色里挑一种食材，变体号决定挑第几个，从而组出不同搭配
const STRUCTURE = {
  breakfast: [['carb'], ['protein', 'dairy'], ['fruit', 'dairy', 'veg']],
  lunch: [['carb'], ['protein'], ['veg'], ['veg']],
  dinner: [['carb'], ['protein'], ['veg'], ['veg']],
  snack: [['dairy', 'protein'], ['fruit', 'fat', 'veg']],
};

const menuKey = (foods) => foods.map((f) => f.id).sort().join('+');

function composeOne(mealKey, foods, variant) {
  return STRUCTURE[mealKey].reduce((used, roles, slot) => {
    const opts = foods.filter((f) => roles.includes(f.role) && !used.includes(f));
    return opts.length ? [...used, opts[(variant * (slot + 1)) % opts.length]] : used;
  }, []);
}

export function composeMenus(mealKey, foods) {
  const seen = new Set();
  return Array.from({ length: MAX_COMPOSED }, (_, v) => composeOne(mealKey, foods, v))
    .filter((picked) => picked.length >= 2 && picked.some((f) => ['protein', 'carb', 'dairy'].includes(f.role)))
    .filter((picked) => {
      const key = menuKey(picked);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((picked) => ({ name: picked.map((f) => f.name).join(' · '), foods: picked, composed: true }));
}

// source: 'library' 菜单库（不足时自动组菜补足）/ 'pantry' 只用冰箱食材
export function candidates(mealKey, pool, source) {
  const byId = new Map(pool.map((f) => [f.id, f]));
  const library = source === 'pantry' ? [] : MENUS[mealKey]
    .filter((m) => m.foods.every((id) => byId.has(id)))
    .map((m) => ({ name: m.name, foods: m.foods.map((id) => byId.get(id)) }));
  const composed = source === 'pantry' || library.length < MIN_LIBRARY ? composeMenus(mealKey, pool) : [];
  const seen = new Set(library.map((m) => menuKey(m.foods)));
  return [...library, ...composed.filter((m) => !seen.has(menuKey(m.foods)))];
}

export function recommend(meal, cands) {
  if (meal.kcal < MIN_MEAL_KCAL) return [];
  return cands
    .map((m) => {
      const res = portion(m.foods, meal.kcal);
      const score = Math.abs(res.total.protein - meal.protein) + Math.abs(res.total.kcal - meal.kcal) * KCAL_WEIGHT;
      return { ...m, res, score };
    })
    .sort((a, b) => a.score - b.score);
}
