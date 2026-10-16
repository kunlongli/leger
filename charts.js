// 手绘 SVG 图表，不引第三方库
import { sortByDate, dayNum, movingAverage, nightRate, sleepHours } from './calc.js';

const W = 800;
const H = 300;
const PAD = { l: 48, r: 20, t: 20, b: 36 };
const DAY_MS = 86400000;
const MAX_PROJECTION_DAYS = 90;
const NIGHT_BARS = 21;

const label = (x) => new Date(x * DAY_MS).toISOString().slice(5, 10);
const scale = (d0, d1, r0, r1) => (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
const path = (pts, sx, sy) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join('');
const range = (n) => Array.from({ length: n }, (_, i) => i);

function projection(last, target, weeklyLossKg) {
  if (!last || last.y <= target || weeklyLossKg <= 0) return [];
  const perDay = weeklyLossKg / 7;
  const days = Math.min(MAX_PROJECTION_DAYS, Math.ceil((last.y - target) / perDay));
  return [last, { x: last.x + days, y: Math.max(target, last.y - perDay * days) }];
}

function yGrid(y0, y1, sy) {
  return range(5).map((i) => {
    const v = y0 + ((y1 - y0) * i) / 4;
    const y = sy(v).toFixed(1);
    return `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" style="stroke:var(--line)"/>
      <text x="${PAD.l - 8}" y="${y}" text-anchor="end" dominant-baseline="middle">${v.toFixed(1)}</text>`;
  }).join('');
}

function xLabels(x0, x1, sx) {
  return range(5).map((i) => {
    const x = Math.round(x0 + ((x1 - x0) * i) / 4);
    return `<text x="${sx(x).toFixed(1)}" y="${H - 10}" text-anchor="middle">${label(x)}</text>`;
  }).join('');
}

export function weightChart(logs, target, weeklyLossKg) {
  const pts = sortByDate(logs).filter((l) => l.morningWeight).map((l) => ({ x: dayNum(l.date), y: l.morningWeight, period: l.period }));
  if (pts.length < 2) return '<div class="empty">至少需要两天的晨起体重才能绘制曲线</div>';
  const steadyPts = pts.filter((p) => !p.period);
  const ma = movingAverage(steadyPts.length >= 2 ? steadyPts : pts); // 均线不含生理期
  const proj = projection(ma.at(-1), target, weeklyLossKg);
  const xs = [...pts, ...proj].map((p) => p.x);
  const ys = [...pts.map((p) => p.y), target];
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.floor(Math.min(...ys) - 0.6), Math.ceil(Math.max(...ys) + 0.6)];
  const sx = scale(x0, x1, PAD.l, W - PAD.r);
  const sy = scale(y0, y1, H - PAD.b, PAD.t);
  const ty = sy(target).toFixed(1);
  const dots = pts.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${p.period ? 3.4 : 2.6}" style="fill:var(${p.period ? '--rose' : '--muted'});opacity:${p.period ? 0.85 : 0.55}"><title>${label(p.x)}  ${p.y}kg${p.period ? '（生理期，不计入均线）' : ''}</title></circle>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="体重曲线">
    ${yGrid(y0, y1, sy)}${xLabels(x0, x1, sx)}
    <line x1="${PAD.l}" x2="${W - PAD.r}" y1="${ty}" y2="${ty}" style="stroke:var(--gold);stroke-dasharray:2 5;stroke-width:1.2"/>
    <text x="${W - PAD.r}" y="${ty - 8}" text-anchor="end" style="fill:var(--gold)">目标 ${target}kg</text>
    ${proj.length ? `<path d="${path(proj, sx, sy)}" style="fill:none;stroke:var(--sage);stroke-width:1.4;stroke-dasharray:6 6"/>` : ''}
    ${dots}
    <path d="${path(ma, sx, sy)}" style="fill:none;stroke:var(--ink);stroke-width:1.8"/>
  </svg>`;
}

export function nightChart(logs, baseline) {
  const nights = sortByDate(logs)
    .map((l) => ({ l, rate: nightRate(l) }))
    .filter((n) => n.rate != null && n.rate > 0)
    .slice(-NIGHT_BARS);
  if (nights.length < 2) return '<div class="empty">记录「睡前体重 + 晨起体重 + 睡眠时间」后，这里会显示每晚的代谢掉秤</div>';
  const max = Math.max(...nights.map((n) => n.rate), baseline ?? 0) * 1.15;
  const sy = scale(0, max, H - PAD.b, PAD.t);
  const slot = (W - PAD.l - PAD.r) / nights.length;
  const barW = Math.min(18, slot * 0.5);
  const bars = nights.map((n, i) => {
    const cx = PAD.l + slot * (i + 0.5);
    const y = sy(n.rate);
    const h = sleepHours(n.l.sleepStart, n.l.wake);
    const loss = Math.round((n.l.eveningWeight - n.l.morningWeight) * 1000);
    const showLabel = i % Math.ceil(nights.length / 7) === 0 || i === nights.length - 1;
    return `<rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${(H - PAD.b - y).toFixed(1)}" style="fill:var(--sage);opacity:${i >= nights.length - 3 ? 1 : 0.45}">
        <title>${n.l.date}  睡眠 ${h.toFixed(1)}h  掉秤 ${loss}g  ${n.rate.toFixed(0)} g/h</title></rect>
      ${showLabel ? `<text x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle">${n.l.date.slice(5)}</text>` : ''}`;
  }).join('');
  const baseLine = baseline
    ? `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${sy(baseline).toFixed(1)}" y2="${sy(baseline).toFixed(1)}" style="stroke:var(--gold);stroke-dasharray:2 5;stroke-width:1.2"/>
       <text x="${W - PAD.r}" y="${(sy(baseline) - 8).toFixed(1)}" text-anchor="end" style="fill:var(--gold)">个人基线 ${baseline.toFixed(0)} g/h</text>`
    : '';
  const grid = range(4).map((i) => {
    const v = (max * i) / 3;
    const y = sy(v).toFixed(1);
    return `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y}" y2="${y}" style="stroke:var(--line)"/><text x="${PAD.l - 8}" y="${y}" text-anchor="end" dominant-baseline="middle">${v.toFixed(0)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="夜间代谢掉秤">${grid}${bars}${baseLine}</svg>`;
}

export function waistChart(logs) {
  const pts = sortByDate(logs).filter((l) => l.waist).map((l) => ({ x: dayNum(l.date), y: l.waist }));
  if (pts.length < 2) return '<div class="empty">每周量一次腰围（肚脐水平、呼气末），记录两次后显示趋势</div>';
  const [x0, x1] = [pts[0].x, pts.at(-1).x];
  const ys = pts.map((p) => p.y);
  const [y0, y1] = [Math.floor(Math.min(...ys) - 1), Math.ceil(Math.max(...ys) + 1)];
  const sx = scale(x0, x1, PAD.l, W - PAD.r);
  const sy = scale(y0, y1, H - PAD.b, PAD.t);
  const dots = pts.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3.5" style="fill:var(--surface);stroke:var(--gold);stroke-width:1.5"><title>${label(p.x)}  ${p.y}cm</title></circle>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="腰围曲线">
    ${yGrid(y0, y1, sy)}${xLabels(x0, x1, sx)}
    <path d="${path(pts, sx, sy)}" style="fill:none;stroke:var(--gold);stroke-width:1.6"/>${dots}
  </svg>`;
}
