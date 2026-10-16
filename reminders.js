// 称重提醒：生成日历文件（.ics），导入手机日历后由系统按时提醒，不需要推送服务器
import { sortByDate } from './calc.js';

const DEFAULT_TIMES = { evening: '22:30', morning: '07:30' };
const RECENT_NIGHTS = 14;
const BEFORE_SLEEP_MIN = 15;
const AFTER_WAKE_MIN = 10;
const DAY_MIN = 1440;
const APP_URL = 'https://kunlongli.github.io/leger/';

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toTime = (m) => {
  const v = ((Math.round(m / 5) * 5) % DAY_MIN + DAY_MIN) % DAY_MIN;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
};
// 入睡时间可能跨午夜（23:30 / 00:30），以中午为原点求平均
const avgClock = (times) => {
  const shifted = times.map((t) => (toMin(t) - 720 + DAY_MIN) % DAY_MIN);
  return shifted.reduce((s, x) => s + x, 0) / shifted.length + 720;
};

// 按近 14 晚的平均作息推荐：入睡前 15 分钟称重、起床后 10 分钟称重
export function suggestedTimes(logs) {
  const nights = sortByDate(logs).filter((l) => l.sleepStart && l.wake).slice(-RECENT_NIGHTS);
  if (!nights.length) return DEFAULT_TIMES;
  return {
    evening: toTime(avgClock(nights.map((l) => l.sleepStart)) - BEFORE_SLEEP_MIN),
    morning: toTime(avgClock(nights.map((l) => l.wake)) + AFTER_WAKE_MIN),
  };
}

const escapeText = (s) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const compactDate = (iso) => iso.replace(/-/g, '');
const compactTime = (t) => `${t.replace(':', '')}00`;

function nextSunday(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

function event({ uid, date, time, rule, summary, detail }, stamp) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@kunlongli.github.io`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${compactDate(date)}T${compactTime(time)}`, // 不带时区 = 设备本地时间
    'DURATION:PT5M',
    `RRULE:${rule}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(`${detail}\n${APP_URL}`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${escapeText(summary)}`,
    'END:VALARM',
    'END:VEVENT',
  ];
}

// UID 固定，重复导入会更新而不是新增（主流日历的行为）
export function buildIcs({ evening, morning }, startDate, now = new Date()) {
  const stamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const events = [
    { uid: 'leger-evening', date: startDate, time: evening, rule: 'FREQ=DAILY', summary: '轻 · 睡前称重', detail: '如厕后、穿同样衣物称重，记录到 LÉGER。' },
    { uid: 'leger-morning', date: startDate, time: morning, rule: 'FREQ=DAILY', summary: '轻 · 晨起空腹称重', detail: '起床如厕后、进食前称重，并记下入睡与起床时间。' },
    { uid: 'leger-waist', date: nextSunday(startDate), time: morning, rule: 'FREQ=WEEKLY;BYDAY=SU', summary: '轻 · 每周量腰围', detail: '肚脐水平、呼气末测量，记录到 LÉGER。' },
  ];
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LEGER//Weight Reminders//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    ...events.flatMap((e) => event(e, stamp)),
    'END:VCALENDAR', '',
  ].join('\r\n');
}
