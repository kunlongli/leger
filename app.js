// 状态 + 派生数据 + 事件分发。视图在 views/，纯计算在 calc.js / menu.js
import { DEFAULT_SETTINGS, metabolism, plan, mealTargets } from './calc.js';
import { analyze } from './advice.js';
import { FOODS } from './data.js';
import { foodPool, remainingMeals } from './menu.js';
import { weeklyReport, renderReportImage } from './report.js';
import {
  loadState, saveState, validateProfile, validateLog, validateState, validateSettings, validateFood, validateEatenMeal,
  upsertLog, syncIntake, sampleState, todayISO, EMPTY_STATE,
} from './store.js';
import { viewToday, viewJournal, viewProgress, viewProfile } from './views/core.js';
import { viewPlan } from './views/plan.js';
import { viewKitchen, selectedOption } from './views/kitchen.js';
import { viewFoods } from './views/foods.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');
const VIEWS = { today: viewToday, journal: viewJournal, plan: viewPlan, kitchen: viewKitchen, foods: viewFoods, progress: viewProgress, profile: viewProfile };
const CLEAR_MSG = { error: '', flash: '', confirmClear: false };

let state = loadState();
let ui = {
  view: state.profile ? 'today' : 'profile',
  meal: null, picks: [], editDate: null, settingsOpen: false,
  source: 'library', menuPage: {}, menuSel: {},
  ...CLEAR_MSG,
};

function setState(next, patch = {}) {
  state = next;
  const saved = saveState(state);
  ui = { ...ui, ...patch, ...(saved ? {} : { error: '保存失败：浏览器存储不可用（是否为无痕模式？）' }) };
  render();
}
const setUi = (patch) => {
  ui = { ...ui, ...patch };
  render();
};
const setPrefs = (patch) => setState({ ...state, prefs: { ...state.prefs, ...patch } }, { menuPage: {}, menuSel: {} });
const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

function derive() {
  const allFoods = [...FOODS, ...state.customFoods];
  const pool = foodPool(allFoods, state.prefs);
  const meta = metabolism(state.profile, state.logs);
  const pl = plan(state.profile, meta, state.settings);
  const dailyKcal = pl.fastDay?.normalKcal ?? pl.intake;
  const meals = mealTargets(dailyKcal, state.profile.fasting, state.settings);
  const analysis = analyze(state.profile, state.logs, meta);
  return {
    meta,
    plan: pl,
    analysis,
    report: weeklyReport(state.logs, dailyKcal, analysis, todayISO()),
    meals,
    remaining: remainingMeals(meals, state.eaten[todayISO()] ?? {}, pl.macros.protein),
    allFoods,
    foodById: new Map(allFoods.map((f) => [f.id, f])),
    pool,
    pantryPool: pool.filter((f) => state.prefs.pantry.includes(f.id)),
  };
}

function render() {
  const view = state.profile ? ui.view : 'profile';
  nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  app.innerHTML = VIEWS[view]({ state, ui, d: state.profile ? derive() : null });
}

const go = (view, patch = {}) => {
  setUi({ ...CLEAR_MSG, view, editDate: null, ...patch });
  window.scrollTo({ top: 0 });
};

nav.addEventListener('click', (e) => {
  const view = e.target.closest('button')?.dataset.view;
  if (!view) return;
  if (!state.profile && view !== 'profile') return setUi({ ...CLEAR_MSG, error: '请先填写身体档案' });
  go(view);
});

function exportData() {
  downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `leger-${todayISO()}.json`);
}

// ---------- 已吃记录 ----------
function recordMeal(key, raw) {
  const { value, error } = validateEatenMeal(raw);
  if (error) return setUi({ ...CLEAR_MSG, error });
  const today = todayISO();
  const day = { ...(state.eaten[today] ?? {}), [key]: value };
  const next = syncIntake({ ...state, eaten: { ...state.eaten, [today]: day } }, today);
  setState(next, { ...CLEAR_MSG, flash: `已记录 ${value.kcal} kcal，已同步到今日摄入，剩余餐次已重新推荐` });
}

function unrecordMeal(key) {
  const today = todayISO();
  const { [key]: _removed, ...rest } = state.eaten[today] ?? {};
  setState(syncIntake({ ...state, eaten: { ...state.eaten, [today]: rest } }, today), CLEAR_MSG);
}

function eatSelected(key) {
  const d = derive();
  const meal = d.remaining.meals.find((m) => m.key === key);
  const option = meal && selectedOption(d, ui, meal);
  if (!option) return;
  recordMeal(key, { kcal: option.res.total.kcal, protein: option.res.total.protein, name: option.name });
}

function downloadBlob(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 触屏设备调起系统分享（可直接发微信），电脑或不支持分享时直接下载
const canShareFiles = (file) => matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] });

async function shareReport() {
  setUi({ ...CLEAR_MSG, flash: '正在生成分享图…' });
  try {
    const blob = await renderReportImage(derive().report);
    const file = new File([blob], `leger-weekly-${todayISO()}.png`, { type: 'image/png' });
    if (canShareFiles(file)) {
      await navigator.share({ files: [file], title: 'LÉGER 本周复盘' });
      return setUi(CLEAR_MSG);
    }
    downloadBlob(blob, file.name);
    setUi({ ...CLEAR_MSG, flash: '分享图已下载' });
  } catch (err) {
    if (err.name === 'AbortError') return setUi(CLEAR_MSG); // 用户关掉了分享面板
    console.error('[leger] 生成周报失败', err);
    setUi({ ...CLEAR_MSG, error: '生成分享图失败，请重试' });
  }
}

function deleteFood(id) {
  const { prefs } = state;
  setState({
    ...state,
    customFoods: state.customFoods.filter((f) => f.id !== id),
    prefs: { ...prefs, exclude: prefs.exclude.filter((x) => x !== id), pantry: prefs.pantry.filter((x) => x !== id) },
  }, { ...CLEAR_MSG, picks: ui.picks.filter((x) => x !== id), flash: '已删除食材' });
}

const ACTIONS = {
  'set-tier': ({ id }) => setState({ ...state, profile: { ...state.profile, tier: id } }),
  'set-fasting': ({ id }) => setState({ ...state, profile: { ...state.profile, fasting: id } }, { meal: null, menuPage: {}, menuSel: {} }),
  'toggle-settings': () => setUi({ ...CLEAR_MSG, settingsOpen: !ui.settingsOpen }),
  'reset-settings': () => setState({ ...state, settings: DEFAULT_SETTINGS }, { ...CLEAR_MSG, flash: '已恢复默认参数' }),
  go: ({ id }) => go(id),
  'go-pantry': () => go('kitchen', { source: 'pantry', menuPage: {}, menuSel: {} }),
  'set-source': ({ id }) => setUi({ source: id, menuPage: {}, menuSel: {} }),
  'select-option': ({ meal, idx }) => setUi({ menuSel: { ...ui.menuSel, [meal]: Number(idx) } }),
  shuffle: ({ meal }) => setUi({ menuPage: { ...ui.menuPage, [meal]: (ui.menuPage[meal] ?? 0) + 1 }, menuSel: { ...ui.menuSel, [meal]: 0 } }),
  'eat-option': ({ meal }) => eatSelected(meal),
  uneat: ({ meal }) => unrecordMeal(meal),
  'toggle-group': ({ id }) => setPrefs({ groups: toggle(state.prefs.groups, id) }),
  'toggle-exclude': ({ id }) => setPrefs({ exclude: toggle(state.prefs.exclude, id) }),
  'toggle-pantry': ({ id }) => setPrefs({ pantry: toggle(state.prefs.pantry, id) }),
  'clear-pantry': () => setPrefs({ pantry: [] }),
  'delete-food': ({ id }) => deleteFood(id),
  'set-meal': ({ id }) => setUi({ meal: id }),
  'toggle-food': ({ id }) => setUi({ picks: toggle(ui.picks, id) }),
  'clear-picks': () => setUi({ picks: [] }),
  'edit-log': ({ date }) => {
    setUi({ ...CLEAR_MSG, editDate: date });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  'delete-log': ({ date }) => setState({ ...state, logs: state.logs.filter((l) => l.date !== date) }, { ...CLEAR_MSG, flash: `已删除 ${date}` }),
  'load-sample': () => setState(sampleState(), { ...CLEAR_MSG, view: 'today' }),
  export: exportData,
  'share-report': shareReport,
  clear: () => (ui.confirmClear
    ? setState(EMPTY_STATE, { ...CLEAR_MSG, view: 'profile', picks: [] })
    : setUi({ confirmClear: true })),
};

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  e.preventDefault();
  ACTIONS[el.dataset.action]?.(el.dataset);
});

// "a.b.c" 形式的表单字段名 → 嵌套对象
const setPath = (o, [k, ...rest], v) => ({ ...o, [k]: rest.length ? setPath(o[k] ?? {}, rest, v) : v });
const nest = (flat) => Object.entries(flat).reduce((acc, [path, v]) => setPath(acc, path.split('.'), v), {});

const FORMS = {
  'profile-form': (raw) => {
    const { value, error } = validateProfile({ tier: 'standard', fasting: 'none', keepMuscle: true, ...state.profile, ...raw });
    if (error) return setUi({ ...CLEAR_MSG, error });
    setState({ ...state, profile: value }, { ...CLEAR_MSG, flash: '档案已保存', view: state.profile ? ui.view : 'today' });
  },
  'log-form': (raw) => {
    const { value, error } = validateLog(raw);
    if (error) return setUi({ ...CLEAR_MSG, error });
    setState({ ...state, logs: upsertLog(state.logs, value) }, { ...CLEAR_MSG, editDate: null, flash: `${value.date} 已保存，代谢与方案已重新计算` });
  },
  'settings-form': (raw) => {
    const { value, error } = validateSettings(nest(raw));
    if (error) return setUi({ ...CLEAR_MSG, error });
    setState({ ...state, settings: value }, { ...CLEAR_MSG, flash: '参数已保存，方案已重新计算' });
  },
  'food-form': (raw) => {
    const { value, error } = validateFood(raw);
    if (error) return setUi({ ...CLEAR_MSG, error });
    setState({ ...state, customFoods: [...state.customFoods, value] }, { ...CLEAR_MSG, flash: `已添加「${value.name}」` });
  },
};

app.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = Object.fromEntries(new FormData(e.target));
  if (e.target.classList.contains('eat-form')) return recordMeal(e.target.dataset.meal, { ...raw, name: '手动记录' });
  FORMS[e.target.id]?.(raw);
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'keep-muscle') setState({ ...state, profile: { ...state.profile, keepMuscle: e.target.checked } });
  if (e.target.id === 'f-date') setUi({ ...CLEAR_MSG, editDate: e.target.value });
  if (e.target.id === 'import-file') importFile(e.target.files[0]);
});

async function importFile(file) {
  if (!file) return;
  try {
    const { value, error } = validateState(JSON.parse(await file.text()));
    if (error) return setUi({ ...CLEAR_MSG, error: `导入失败：${error}` });
    setState(value, { ...CLEAR_MSG, flash: `已导入 ${value.logs.length} 条记录` });
  } catch (err) {
    console.error('[leger] 导入失败', err);
    setUi({ ...CLEAR_MSG, error: '导入失败：文件不是有效的 JSON' });
  }
}

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch((err) => console.error('[leger] 离线缓存注册失败', err));
}
