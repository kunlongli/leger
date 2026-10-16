// 理论依据：应用里的关键数字都对应到这里的指南条目。改数字前先核对原文。
export const SOURCES = {
  obesity2024: {
    name: '《成人肥胖食养指南（2024年版）》',
    org: '国家卫生健康委员会',
    url: 'http://www.hbjs.gov.cn/xxgk/dfbmptlj/xz/xwsjkj/GGWSZSXX/202209/t20220914_1353047.shtml',
  },
  mnt2021: {
    name: '《中国超重/肥胖医学营养治疗指南（2021）》',
    org: '中国医疗保健国际交流促进会营养与代谢管理分会等',
    url: 'https://baike.baidu.com/item/%E4%B8%AD%E5%9B%BD%E8%B6%85%E9%87%8D/%E8%82%A5%E8%83%96%E5%8C%BB%E5%AD%A6%E8%90%A5%E5%85%BB%E6%B2%BB%E7%96%97%E6%8C%87%E5%8D%97(2021)/58160783',
  },
  issn2017: {
    name: 'ISSN Position Stand: Protein and Exercise（2017）',
    org: 'Jäger et al., J Int Soc Sports Nutr 14:20',
    url: 'https://doi.org/10.1186/s12970-017-0177-8',
  },
};

export const GUIDE = {
  deficit: [500, 1000], // kcal/日
  macroPct: { protein: [15, 20], fat: [20, 30], carbs: [50, 60] },
  monthlyLossKg: [2, 4],
  sixMonthLossPct: [5, 10],
  cardioMinutes: [150, 300],
  strengthDays: [2, 3],
  sleepHours: 7,
  proteinPerKgActive: [1.4, 2.0],
};

// 每周下降超过这个值视为过快（指南：每月 2–4kg ≈ 每周不超过 1kg）
export const MAX_WEEKLY_LOSS_KG = 1;

export const MEAL_RULES = [
  '进餐顺序：先吃蔬菜，再吃肉蛋豆，最后吃主食，有助于减少高能量食物的进食量',
  '细嚼慢咽：同样的食物吃慢一点，总食量更少、饱腹感更强',
  '每天食盐不超过 5g、烹调油 20–25g、添加糖不超过 25g',
  '少吃每 100g 超过 400kcal 的高能量食物：油炸食品、糕点、肥肉，坚果也要限量',
];

// 方案页「理论依据」：规则 → 出处
export const BASIS = [
  { rule: '每日能量缺口 500–1000kcal（「温和」档 300kcal 为入门过渡）', src: 'obesity2024' },
  { rule: '三大营养素供能比：脂肪 20–30%、蛋白质 15–20%、碳水 50–60%；三餐 3:4:3', src: 'obesity2024' },
  { rule: '合理减重速度每月 2–4kg，6 个月减当前体重的 5–10%', src: 'obesity2024' },
  { rule: '运动以中等强度有氧为主，每周 150–300 分钟；抗阻每周 2–3 天、隔天、每次 10–20 分钟', src: 'obesity2024' },
  { rule: '每天保证 7 小时左右睡眠，作息不规律可能导致代谢紊乱', src: 'obesity2024' },
  { rule: '限能量平衡膳食、高蛋白膳食、轻断食（5:2 / 16:8）均为可选的减重膳食模式', src: 'mnt2021' },
  { rule: '摄入下限：男性 1500kcal、女性 1200kcal（取指南限能量范围的上沿，困难模式也不低于此）', src: 'mnt2021' },
  { rule: '保肌模式蛋白质 1.8g/kg：有运动习惯者每日 1.4–2.0g/kg 足以维持和增加肌肉', src: 'issn2017' },
  { rule: '夜间掉秤指数与自适应 TDEE 为本应用的工程估算，用于个性化校准，不属于指南内容', src: null },
];
