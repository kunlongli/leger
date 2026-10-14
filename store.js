// 本地存储 + 输入校验（表单与导入共用同一套校验）
import { TIERS, FASTING, ACTIVITY_FACTORS } from './calc.js';

const KEY = 'leger.v1';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_NIGHT_LOSS_KG = 3;

const RANGE = {
  age: [14, 90, '年龄'],
  height: [120, 230, '身高'],
  weight: [30, 250, '体重'],
  target: [30, 250, '目标体重'],
  bodyFat: [3, 60, '体脂率'],
  morningWeight: [30, 250, '晨起体重'],
  eveningWeight: [30, 250, '睡前体重'],
  intake: [0, 8000, '实际摄入'],
  steps: [0, 80000, '步数'],
};

class ValidationError extends Error {}

const blank = (v) => v === undefined || v === null || v === '';
const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => isoDate(new Date());

function num(raw, key, required) {
  if (blank(raw)) {
    if (required) throw new ValidationError(`请填写${RANGE[key][2]}`);
    return null;
  }
  const v = Number(raw);
  const [lo, hi, label] = RANGE[key];
  if (!Number.isFinite(v) || v < lo || v > hi) throw new ValidationError(`${label}应在 ${lo}–${hi} 之间`);
  return v;
}

function oneOf(raw, allowed, label) {
  if (!allowed.includes(raw)) throw new ValidationError(`${label}无效`);
  return raw;
}

function time(raw, label) {
  if (blank(raw)) return null;
  if (!TIME_RE.test(raw)) throw new ValidationError(`${label}格式应为 HH:MM`);
  return raw;
}

function buildProfile(raw) {
  return {
    sex: oneOf(raw.sex, ['male', 'female'], '性别'),
    age: num(raw.age, 'age', true),
    height: num(raw.height, 'height', true),
    weight: num(raw.weight, 'weight', true),
    target: num(raw.target, 'target', true),
    bodyFat: num(raw.bodyFat, 'bodyFat', false),
    activity: oneOf(raw.activity, Object.keys(ACTIVITY_FACTORS), '活动水平'),
    tier: oneOf(raw.tier ?? 'standard', TIERS.map((t) => t.id), '档位'),
    fasting: oneOf(raw.fasting ?? 'none', Object.keys(FASTING), '断食模式'),
    keepMuscle: raw.keepMuscle === true || raw.keepMuscle === 'on',
  };
}

function buildLog(raw) {
  if (!DATE_RE.test(raw.date ?? '') || Number.isNaN(Date.parse(raw.date))) throw new ValidationError('请选择日期');
  const log = {
    date: raw.date,
    eveningWeight: num(raw.eveningWeight, 'eveningWeight', false),
    morningWeight: num(raw.morningWeight, 'morningWeight', false),
    sleepStart: time(raw.sleepStart, '入睡时间'),
    wake: time(raw.wake, '起床时间'),
    intake: num(raw.intake, 'intake', false),
    steps: num(raw.steps, 'steps', false),
  };
  if (!log.morningWeight && !log.eveningWeight) throw new ValidationError('至少填写一个体重');
  if (!log.sleepStart !== !log.wake) throw new ValidationError('入睡与起床时间需同时填写');
  if (log.morningWeight && log.eveningWeight) {
    const loss = log.eveningWeight - log.morningWeight;
    if (loss < -1 || loss > MAX_NIGHT_LOSS_KG) throw new ValidationError('睡前与晨起体重差异异常，请检查是否输错');
  }
  return log;
}

// 返回 { value } 或 { error }，调用方不需要 try/catch
const safely = (fn) => (raw) => {
  try {
    return { value: fn(raw) };
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message };
    throw e;
  }
};
export const validateProfile = safely(buildProfile);
export const validateLog = safely(buildLog);

export const EMPTY_STATE = { profile: null, logs: [] };

function buildState(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.logs)) throw new ValidationError('文件格式不正确');
  return {
    profile: raw.profile ? buildProfile(raw.profile) : null,
    logs: raw.logs.map(buildLog),
  };
}
export const validateState = safely(buildState);

export function loadState() {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return EMPTY_STATE;
    const { value, error } = validateState(JSON.parse(text));
    if (error) throw new Error(error);
    return value;
  } catch (e) {
    console.error('[leger] 读取本地数据失败，已使用空数据', e);
    return EMPTY_STATE;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('[leger] 保存失败', e);
    return false;
  }
}

export const upsertLog = (logs, log) => [...logs.filter((l) => l.date !== log.date), log];

const fmtTime = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

// 演示数据：35 天，含睡眠与夜间掉秤
export function sampleState(today = new Date()) {
  const days = 35;
  const noise = (i, k) => Math.sin(i * 12.9898 + k) * 0.5;
  const logs = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i));
    const morning = 82.4 - 0.075 * i + noise(i, 1) * 0.5;
    const sleepMin = 23 * 60 + Math.round((noise(i, 2) + 0.5) * 90);
    const sleepLen = 6.3 * 60 + Math.round((noise(i, 3) + 0.5) * 100);
    return {
      date: isoDate(d),
      morningWeight: +morning.toFixed(1),
      eveningWeight: +(morning + 0.45 + (noise(i, 4) + 0.5) * 0.4).toFixed(1),
      sleepStart: fmtTime(sleepMin),
      wake: fmtTime(Math.round(sleepMin + sleepLen)),
      intake: Math.round(1750 + noise(i, 5) * 300),
      steps: Math.round(6000 + noise(i, 6) * 5000),
    };
  });
  return {
    profile: { sex: 'male', age: 32, height: 175, weight: 82.4, target: 72, bodyFat: null, activity: 'sedentary', tier: 'standard', fasting: 'none', keepMuscle: true },
    logs,
  };
}
