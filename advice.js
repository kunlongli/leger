// 阶段判断 + 建议：规则表，按优先级取第一个命中的阶段
import { sortByDate, weightTrend, sleepHours, latestWeight, dayNum } from './calc.js';

const FAST_LOSS_PCT = 0.01; // 每周掉体重 >1% 视为过快
const PLATEAU_KG = 0.3; // 14 天趋势变化 < 0.3kg 视为平台
const GOOD_SLEEP_H = 7;
const WAIST_WINDOW_DAYS = 21;
const WAIST_MIN_SPAN_DAYS = 7;
const WAIST_SIGNIFICANT_CM = 1;

// 近 3 周腰围变化（cm），两次测量需相隔至少 7 天，否则返回 null
export function waistChange(logs) {
  const pts = sortByDate(logs).filter((l) => l.waist);
  if (pts.length < 2) return null;
  const last = pts.at(-1);
  const first = pts.find((p) => dayNum(last.date) - dayNum(p.date) <= WAIST_WINDOW_DAYS);
  if (dayNum(last.date) - dayNum(first.date) < WAIST_MIN_SPAN_DAYS) return null;
  return +(last.waist - first.waist).toFixed(1);
}

function avgSleep(logs) {
  const hs = logs.filter((l) => l.sleepStart && l.wake).slice(-7).map((l) => sleepHours(l.sleepStart, l.wake));
  return hs.length ? hs.reduce((s, x) => s + x, 0) / hs.length : null;
}

function stageOf({ count, remaining, weeklyKg, weeklyPct, change14, isLosing }) {
  if (count < 5) return {
    key: 'start', name: '起步期',
    summary: '先连续记录一周晨重与睡前体重，系统会逐步校准你的真实代谢。',
  };
  if (remaining <= 0) return {
    key: 'maintain', name: '维持期',
    summary: '已到达目标。把摄入回调到维持热量（TDEE），继续力量训练巩固成果。',
  };
  if (weeklyPct < -FAST_LOSS_PCT) return {
    key: 'fast', name: '下降过快',
    summary: `近期每周下降约 ${Math.abs(weeklyKg).toFixed(2)}kg，超过体重的 1%，肌肉流失风险上升。`,
  };
  if (weeklyKg > 0.1) return {
    key: 'rebound', name: '反弹预警',
    summary: `近两周体重呈上升趋势（每周 +${weeklyKg.toFixed(2)}kg），需要回看饮食记录。`,
  };
  if (count >= 14 && Math.abs(change14) < PLATEAU_KG) return {
    key: 'plateau', name: '平台期',
    summary: '两周内趋势几乎持平。这是身体的正常适应，不要再进一步节食。',
  };
  if (remaining <= 2) return {
    key: 'final', name: '冲刺塑形期',
    summary: `距离目标仅剩 ${remaining.toFixed(1)}kg，重心从减重转向体态与围度。`,
  };
  return {
    key: isLosing ? 'steady' : 'adjust', name: isLosing ? '稳定减脂期' : '调整期',
    summary: isLosing ? `每周稳定下降约 ${Math.abs(weeklyKg).toFixed(2)}kg，节奏健康，保持即可。` : '趋势变化不明显，继续观察一周。',
  };
}

const STAGE_TIPS = {
  start: ['每天固定时间称重：睡前一次、晨起排空后一次', '先不急着大幅缩减饮食，从「温和」或「标准」档开始'],
  maintain: ['每周提高 100–150kcal，直到体重稳定', '保留每周 3 次力量训练'],
  fast: ['把档位下调一级，或每天增加 150–200kcal 碳水', '确保蛋白质吃够，开启「保持肌肉量」', '关注是否头晕、乏力、脱发'],
  rebound: ['核对是否遗漏零食、饮料、酱汁的热量', '周末是高发期：提前规划外食', '睡眠不足会推高食欲，优先早睡'],
  plateau: ['安排 1–2 天「补碳日」：摄入回到 TDEE，主要加碳水', '每日额外 +2000 步，比再减饮食更有效', '检查称重习惯：生理期、高盐饮食会造成水分滞留'],
  final: ['可短期尝试「困难模式」或 16:8 轻断食，但不超过 4 周', '多关注腰围、照片变化，体重波动会更大'],
  steady: ['保持当前档位，无需调整', '每两周复盘一次腰围'],
  adjust: ['先保证每日记录完整', '如果连续两周不降，考虑上调一档'],
};

export function analyze(profile, logs, meta) {
  const sorted = sortByDate(logs);
  const weighed = sorted.filter((l) => l.morningWeight);
  const trend = weightTrend(sorted, 14) ?? 0;
  const weight = latestWeight(profile, sorted);
  const weeklyKg = trend * 7;
  const facts = {
    count: weighed.length,
    remaining: weight - profile.target,
    weeklyKg,
    weeklyPct: weeklyKg / weight,
    change14: trend * 14,
    isLosing: weeklyKg < -0.1,
  };
  const stage = stageOf(facts);
  const tips = [...STAGE_TIPS[stage.key]];

  const sleep = avgSleep(sorted);
  if (sleep != null && sleep < GOOD_SLEEP_H) {
    tips.push(`近 7 天平均睡眠 ${sleep.toFixed(1)}h，低于 7h。睡眠不足会降低夜间消耗、推高饥饿感，建议提前 30 分钟上床。`);
  }
  const ratio = meta.night.ratio;
  if (ratio != null && ratio < 0.85) tips.push('近 3 晚睡眠掉秤明显少于你的基线：可能是晚餐偏咸、饮水不足或压力大，代谢有放缓迹象。');
  if (ratio != null && ratio > 1.15) tips.push('近 3 晚睡眠掉秤高于基线，代谢活跃。注意晚间补水，避免把脱水误判为减脂。');
  const waist = waistChange(sorted);
  if (waist != null && waist <= -WAIST_SIGNIFICANT_CM) {
    tips.unshift(stage.key === 'plateau'
      ? `体重停滞，但近 3 周腰围减少了 ${Math.abs(waist)}cm：脂肪仍在减少，体重不动多是水分波动，坚持当前方案。`
      : `近 3 周腰围减少 ${Math.abs(waist)}cm，减脂有效。`);
  }
  if (waist != null && waist >= WAIST_SIGNIFICANT_CM && facts.isLosing) {
    tips.push(`体重在降，腰围却增加了 ${waist}cm：先确认测量位置一致（肚脐水平、呼气末），再检查蛋白质与力量训练是否到位。`);
  }
  if (!profile.keepMuscle && facts.count >= 5) tips.push('建议开启「保持肌肉量」：每周 3 次力量训练能让掉的更多是脂肪。');

  return { stage, tips, facts, sleep, waist };
}
