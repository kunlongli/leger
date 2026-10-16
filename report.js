// 周报：近 7 天 vs 前 7 天的统计（纯函数），以及绘制成 1080×1350 分享图（canvas）
import { dayNum, sleepHours } from './calc.js';

const WEEK = 7;
const ON_TARGET_RATIO = 0.1; // 实际摄入在目标 ±10% 内算达标
const DAY_MS = 86400000;
const isoOf = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

export function weeklyReport(logs, intakeTarget, analysis, today) {
  const end = dayNum(today);
  const within = (from, to) => logs.filter((l) => {
    const n = dayNum(l.date);
    return n <= end - from && n > end - to;
  });
  const thisWeek = within(0, WEEK);
  const lastWeek = within(WEEK, WEEK * 2);
  const weightOf = (list) => avg(list.filter((l) => l.morningWeight).map((l) => l.morningWeight));
  const weight = weightOf(thisWeek);
  const lastWeight = weightOf(lastWeek);
  const latestWaist = (list) => [...list].filter((l) => l.waist).sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.waist ?? null;
  const waistNow = latestWaist(thisWeek);
  const waistBefore = latestWaist(logs.filter((l) => dayNum(l.date) <= end - WEEK));
  const intakeDays = thisWeek.filter((l) => l.intake);
  return {
    from: isoOf(end - WEEK + 1),
    to: today,
    loggedDays: new Set(thisWeek.map((l) => l.date)).size,
    weight,
    weightDelta: weight != null && lastWeight != null ? weight - lastWeight : null,
    waistDelta: waistNow != null && waistBefore != null ? waistNow - waistBefore : null,
    sleep: avg(thisWeek.filter((l) => l.sleepStart && l.wake).map((l) => sleepHours(l.sleepStart, l.wake))),
    intakeAvg: avg(intakeDays.map((l) => l.intake)),
    intakeDays: intakeDays.length,
    onTarget: intakeDays.filter((l) => Math.abs(l.intake - intakeTarget) <= intakeTarget * ON_TARGET_RATIO).length,
    steps: avg(thisWeek.filter((l) => l.steps).map((l) => l.steps)),
    stage: analysis.stage.name,
    tips: analysis.tips.slice(0, 2),
  };
}

const signed = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(d)}`;

// 周报四宫格：网页与图片共用
export function reportStats(r) {
  return [
    { label: '体重 · 7日均', value: r.weight != null ? r.weight.toFixed(1) : '—', unit: 'kg', note: r.weightDelta != null ? `较上周 ${signed(r.weightDelta)} kg` : '上周数据不足' },
    { label: '平均睡眠', value: r.sleep != null ? r.sleep.toFixed(1) : '—', unit: 'h', note: '指南：每天 7 小时左右' },
    { label: '热量达标', value: r.intakeDays ? `${r.onTarget}/${r.intakeDays}` : '—', unit: '天', note: r.intakeAvg != null ? `日均 ${Math.round(r.intakeAvg)} kcal` : '本周未记录摄入' },
    r.waistDelta != null
      ? { label: '腰围变化', value: signed(r.waistDelta), unit: 'cm', note: '较上次测量' }
      : { label: '日均步数', value: r.steps != null ? String(Math.round(r.steps)) : '—', unit: '步', note: '记录腰围后这里显示腰围变化' },
  ];
}

// ---------- 分享图（固定浅色，不跟随深色模式） ----------
const IMG = { w: 1080, h: 1350, pad: 96 };
const LAYOUT = { statsTop: 440, rowH: 250, valueY: 95, noteY: 172, boxTop: 910, boxH: 330, tipTop: 160, tipLine: 44, maxTipLines: 4 };
const C = { bg: '#f5f2ec', ink: '#1b1a17', muted: '#8c857a', gold: '#a3835a', sage: '#3e5446', light: '#f2efe8' };
const F = {
  brand: "400 44px 'Cormorant Garamond', serif",
  mark: "400 28px 'Noto Serif SC', serif",
  eyebrow: "400 24px 'Jost', sans-serif",
  title: "500 76px 'Noto Serif SC', serif",
  label: "400 26px 'Noto Serif SC', serif",
  value: "300 100px 'Cormorant Garamond', serif",
  unit: "400 30px 'Jost', sans-serif",
  note: "400 24px 'Noto Serif SC', serif",
  tag: "500 28px 'Noto Serif SC', serif",
  tip: "400 28px 'Noto Serif SC', serif",
};

// 中文逐字折行
function wrap(ctx, text, maxWidth) {
  return [...text].reduce((lines, ch) => {
    const last = lines.at(-1);
    return ctx.measureText(last + ch).width > maxWidth ? [...lines, ch] : [...lines.slice(0, -1), last + ch];
  }, ['']);
}

function drawStats(ctx, stats) {
  const colW = (IMG.w - IMG.pad * 2) / 2;
  stats.forEach((s, i) => {
    const x = IMG.pad + (i % 2) * colW;
    const y = LAYOUT.statsTop + Math.floor(i / 2) * LAYOUT.rowH;
    ctx.fillStyle = C.muted; ctx.font = F.label; ctx.fillText(s.label, x, y);
    ctx.fillStyle = C.ink; ctx.font = F.value; ctx.fillText(s.value, x, y + LAYOUT.valueY);
    const vw = ctx.measureText(s.value).width;
    ctx.fillStyle = C.muted; ctx.font = F.unit; ctx.fillText(s.unit, x + vw + 12, y + LAYOUT.valueY);
    ctx.font = F.note; ctx.fillText(s.note, x, y + LAYOUT.noteY); // Cormorant 是旧式数字，9/7 下伸，留足间距
  });
}

function drawAdvice(ctx, r) {
  const top = LAYOUT.boxTop;
  const innerX = IMG.pad + 48;
  const innerW = IMG.w - IMG.pad * 2 - 96;
  ctx.fillStyle = C.sage; ctx.fillRect(IMG.pad, top, IMG.w - IMG.pad * 2, LAYOUT.boxH);
  ctx.font = F.tag;
  ctx.strokeStyle = C.light; ctx.lineWidth = 1.5;
  ctx.strokeRect(innerX, top + 48, ctx.measureText(r.stage).width + 48, 56);
  ctx.fillStyle = C.light; ctx.fillText(r.stage, innerX + 24, top + 86);
  ctx.font = F.tip;
  const lines = r.tips.flatMap((t) => wrap(ctx, `— ${t}`, innerW));
  const shown = lines.slice(0, LAYOUT.maxTipLines);
  if (lines.length > shown.length) shown[shown.length - 1] = `${shown.at(-1).slice(0, -1)}…`;
  shown.forEach((line, i) => ctx.fillText(line, innerX, top + LAYOUT.tipTop + i * LAYOUT.tipLine));
}

export async function renderReportImage(r) {
  const stats = reportStats(r);
  const allText = ['LÉGER 轻 本周复盘 WEEKLY REVIEW 记录天', r.from, r.to, r.stage, ...r.tips, ...stats.flatMap((s) => [s.label, s.value, s.unit, s.note])].join('');
  await Promise.all(Object.values(F).map((f) => document.fonts.load(f, allText))); // 按需加载 unicode-range 分片，否则 canvas 用回退字体
  const canvas = Object.assign(document.createElement('canvas'), { width: IMG.w, height: IMG.h });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, IMG.w, IMG.h);
  ctx.fillStyle = C.ink; ctx.font = F.brand; ctx.fillText('L É G E R', IMG.pad, 150);
  const brandW = ctx.measureText('L É G E R').width;
  ctx.fillStyle = C.gold; ctx.font = F.mark; ctx.fillText('轻', IMG.pad + brandW + 16, 150);
  ctx.fillStyle = C.muted; ctx.font = F.eyebrow; ctx.fillText(`WEEKLY REVIEW · ${r.from.slice(5)} — ${r.to.slice(5)}`, IMG.pad, 230);
  ctx.fillStyle = C.ink; ctx.font = F.title; ctx.fillText('本周复盘', IMG.pad, 330);
  ctx.fillRect(IMG.pad, 375, IMG.w - IMG.pad * 2, 2);
  drawStats(ctx, stats);
  drawAdvice(ctx, r);
  ctx.fillStyle = C.muted; ctx.font = F.note;
  ctx.fillText(`本周记录 ${r.loggedDays}/7 天`, IMG.pad, IMG.h - 64);
  ctx.textAlign = 'right';
  ctx.fillText('kunlongli.github.io/leger', IMG.w - IMG.pad, IMG.h - 64);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('生成图片失败'))), 'image/png'));
}
