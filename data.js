// 食材库（每 100g 可食部，近似值，参考《中国食物成分表》）
// role: protein 蛋白质 / carb 主食 / veg 蔬菜 / fat 油脂坚果 / dairy 奶类 / fruit 水果
export const FOODS = [
  { id: 'chicken', name: '鸡胸肉', role: 'protein', kcal: 133, p: 24.6, c: 0.6, f: 3.5 },
  { id: 'beef', name: '牛里脊', role: 'protein', kcal: 107, p: 22.2, c: 2.4, f: 0.9 },
  { id: 'shrimp', name: '虾仁', role: 'protein', kcal: 93, p: 18.6, c: 2.8, f: 0.8 },
  { id: 'salmon', name: '三文鱼', role: 'protein', kcal: 139, p: 17.2, c: 0, f: 7.8 },
  { id: 'cod', name: '鳕鱼', role: 'protein', kcal: 88, p: 20.4, c: 0.5, f: 0.5 },
  { id: 'egg', name: '鸡蛋', role: 'protein', kcal: 139, p: 13.1, c: 2.4, f: 8.6 },
  { id: 'tofu', name: '北豆腐', role: 'protein', kcal: 116, p: 9.2, c: 3.0, f: 8.1 },
  { id: 'pork', name: '猪里脊', role: 'protein', kcal: 155, p: 20.2, c: 0.7, f: 7.9 },
  { id: 'duck', name: '去皮鸭腿', role: 'protein', kcal: 140, p: 19.0, c: 0.2, f: 7.0 },
  { id: 'brownrice', name: '糙米饭', role: 'carb', kcal: 111, p: 2.6, c: 23.0, f: 0.9 },
  { id: 'rice', name: '白米饭', role: 'carb', kcal: 116, p: 2.6, c: 25.9, f: 0.3 },
  { id: 'oats', name: '燕麦片', role: 'carb', kcal: 338, p: 10.1, c: 77.4, f: 0.2 },
  { id: 'sweetpotato', name: '红薯', role: 'carb', kcal: 86, p: 1.6, c: 20.1, f: 0.1 },
  { id: 'corn', name: '玉米', role: 'carb', kcal: 112, p: 4.0, c: 22.8, f: 1.2 },
  { id: 'wholewheat', name: '全麦面包', role: 'carb', kcal: 246, p: 8.5, c: 46.1, f: 3.5 },
  { id: 'buckwheat', name: '荞麦面(熟)', role: 'carb', kcal: 120, p: 4.5, c: 24.0, f: 0.7 },
  { id: 'potato', name: '土豆', role: 'carb', kcal: 81, p: 2.6, c: 17.8, f: 0.2 },
  { id: 'quinoa', name: '藜麦饭', role: 'carb', kcal: 120, p: 4.4, c: 21.3, f: 1.9 },
  { id: 'broccoli', name: '西兰花', role: 'veg', kcal: 36, p: 4.1, c: 4.3, f: 0.6 },
  { id: 'spinach', name: '菠菜', role: 'veg', kcal: 28, p: 2.6, c: 4.5, f: 0.3 },
  { id: 'tomato', name: '番茄', role: 'veg', kcal: 20, p: 0.9, c: 4.0, f: 0.2 },
  { id: 'cucumber', name: '黄瓜', role: 'veg', kcal: 16, p: 0.8, c: 2.9, f: 0.2 },
  { id: 'lettuce', name: '生菜', role: 'veg', kcal: 15, p: 1.4, c: 2.1, f: 0.4 },
  { id: 'asparagus', name: '芦笋', role: 'veg', kcal: 22, p: 2.6, c: 4.9, f: 0.1 },
  { id: 'mushroom', name: '香菇', role: 'veg', kcal: 26, p: 2.2, c: 5.2, f: 0.3 },
  { id: 'bokchoy', name: '上海青', role: 'veg', kcal: 15, p: 1.5, c: 2.4, f: 0.3 },
  { id: 'olive', name: '橄榄油', role: 'fat', kcal: 899, p: 0, c: 0, f: 99.9 },
  { id: 'almond', name: '巴旦木', role: 'fat', kcal: 600, p: 21.0, c: 20.0, f: 50.0 },
  { id: 'avocado', name: '牛油果', role: 'fat', kcal: 171, p: 2.0, c: 7.4, f: 15.3 },
  { id: 'milk', name: '低脂牛奶', role: 'dairy', kcal: 44, p: 3.4, c: 5.0, f: 1.2 },
  { id: 'yogurt', name: '无糖酸奶', role: 'dairy', kcal: 72, p: 3.2, c: 5.0, f: 3.5 },
  { id: 'soymilk', name: '无糖豆浆', role: 'dairy', kcal: 31, p: 3.0, c: 1.2, f: 1.6 },
  { id: 'apple', name: '苹果', role: 'fruit', kcal: 53, p: 0.4, c: 13.7, f: 0.2 },
  { id: 'blueberry', name: '蓝莓', role: 'fruit', kcal: 57, p: 0.7, c: 14.5, f: 0.3 },
  { id: 'banana', name: '香蕉', role: 'fruit', kcal: 93, p: 1.4, c: 22.0, f: 0.2 },
];

export const ROLE_NAMES = {
  protein: '优质蛋白', carb: '主食', veg: '蔬菜', fat: '油脂坚果', dairy: '奶 · 豆奶', fruit: '水果',
};

// 忌口 / 饮食偏好：选中后推荐时避开这些食材
export const PREF_GROUPS = {
  seafood: { name: '不吃海鲜', foods: ['shrimp', 'salmon', 'cod'] },
  beef: { name: '不吃牛肉', foods: ['beef'] },
  pork: { name: '不吃猪肉', foods: ['pork'] },
  vegetarian: { name: '素食', foods: ['chicken', 'beef', 'pork', 'duck', 'shrimp', 'salmon', 'cod'] },
  dairy: { name: '不喝牛奶', foods: ['milk', 'yogurt'] },
  egg: { name: '不吃鸡蛋', foods: ['egg'] },
};

// 菜单库：推荐时按忌口过滤，再按蛋白质缺口排序
export const MENUS = {
  breakfast: [
    { name: '全麦吐司 · 水煮蛋 · 牛奶', foods: ['wholewheat', 'egg', 'milk'] },
    { name: '燕麦酸奶杯 · 蓝莓', foods: ['oats', 'yogurt', 'blueberry'] },
    { name: '蒸玉米 · 鸡蛋 · 无糖豆浆', foods: ['corn', 'egg', 'soymilk'] },
    { name: '红薯 · 鸡蛋 · 苹果', foods: ['sweetpotato', 'egg', 'apple'] },
    { name: '全麦鸡胸三明治 · 生菜番茄', foods: ['wholewheat', 'chicken', 'lettuce', 'tomato'] },
    { name: '燕麦豆浆 · 香蕉 · 巴旦木', foods: ['oats', 'soymilk', 'banana', 'almond'] },
    { name: '牛油果吐司 · 水煮蛋', foods: ['wholewheat', 'avocado', 'egg'] },
  ],
  lunch: [
    { name: '糙米饭 · 黑椒鸡胸 · 蒜蓉西兰花', foods: ['brownrice', 'chicken', 'broccoli', 'olive'] },
    { name: '荞麦面 · 番茄牛里脊 · 上海青', foods: ['buckwheat', 'beef', 'tomato', 'bokchoy'] },
    { name: '藜麦饭 · 香煎三文鱼 · 芦笋', foods: ['quinoa', 'salmon', 'asparagus'] },
    { name: '米饭 · 青椒里脊 · 清炒菠菜', foods: ['rice', 'pork', 'spinach', 'olive'] },
    { name: '糙米饭 · 卤鸭腿 · 香菇青菜', foods: ['brownrice', 'duck', 'mushroom', 'bokchoy'] },
    { name: '藜麦鸡胸沙拉 · 牛油果', foods: ['quinoa', 'chicken', 'lettuce', 'cucumber', 'avocado'] },
    { name: '米饭 · 麻婆豆腐 · 蒜蓉西兰花', foods: ['rice', 'tofu', 'broccoli'] },
  ],
  dinner: [
    { name: '蒸红薯 · 白灼虾仁 · 清炒菠菜', foods: ['sweetpotato', 'shrimp', 'spinach', 'olive'] },
    { name: '土豆 · 清蒸鳕鱼 · 香菇青菜', foods: ['potato', 'cod', 'mushroom', 'bokchoy'] },
    { name: '小份米饭 · 家常豆腐 · 凉拌黄瓜', foods: ['rice', 'tofu', 'cucumber'] },
    { name: '玉米 · 番茄炒蛋 · 生菜', foods: ['corn', 'egg', 'tomato', 'lettuce'] },
    { name: '荞麦面 · 鸡胸肉 · 芦笋', foods: ['buckwheat', 'chicken', 'asparagus', 'olive'] },
    { name: '红薯 · 黑椒牛柳 · 西兰花', foods: ['sweetpotato', 'beef', 'broccoli'] },
    { name: '豆腐番茄汤 · 小份糙米 · 上海青', foods: ['tofu', 'tomato', 'brownrice', 'bokchoy'] },
  ],
  snack: [
    { name: '无糖酸奶 · 巴旦木', foods: ['yogurt', 'almond'] },
    { name: '苹果 · 低脂牛奶', foods: ['apple', 'milk'] },
    { name: '香蕉 · 无糖豆浆', foods: ['banana', 'soymilk'] },
    { name: '水煮蛋 · 黄瓜', foods: ['egg', 'cucumber'] },
    { name: '蓝莓 · 无糖酸奶', foods: ['blueberry', 'yogurt'] },
  ],
};

// 久坐上班族的保肌训练：徒手 / 弹力带即可，每次 30–40 分钟
const BASE_WEEK = [
  { day: '周一', strength: true, focus: '下肢 · 核心', items: ['徒手深蹲 4×12', '后撤箭步蹲 3×10/侧', '臀桥 3×15', '平板支撑 3×40s'] },
  { day: '周二', strength: true, focus: '上肢 · 推', items: ['俯卧撑（可跪姿）4×8–12', '弹力带推胸 3×12', '哑铃 / 水瓶推举 3×12', '死虫 3×10/侧'] },
  { day: '周三', focus: '有氧 · 二区', items: ['快走或单车 35 分钟', '心率维持在 (220-年龄)×60–70%'] },
  { day: '周四', strength: true, focus: '下肢 · 后链', items: ['罗马尼亚硬拉（哑铃/弹力带）4×10', '保加利亚分腿蹲 3×8/侧', '侧桥 3×30s/侧'] },
  { day: '周五', strength: true, focus: '上肢 · 拉', items: ['弹力带划船 4×12', '反向飞鸟 3×15', '门框引体 / 毛巾划船 3×10', '超人式 3×12'] },
  { day: '周六', focus: '有氧 · 户外', items: ['快走 / 爬坡 / 游泳 45 分钟'] },
  { day: '周日', focus: '恢复', items: ['全身拉伸 15 分钟', '泡沫轴放松', '早睡'] },
];

export const DESK_ROUTINE = [
  '每坐 45 分钟起身 2 分钟：靠墙站 / 提踵 20 次',
  '午饭后散步 10–15 分钟，帮助控糖',
  '能站着开的会就站着开，电话边走边打',
  '通勤提前一站下车，日常步数打底 6000',
];

export function trainingWeek(tierId) {
  const extraSet = tierId === 'active' || tierId === 'hard';
  return BASE_WEEK.map((d) => ({
    ...d,
    items: extraSet && d.strength ? [...d.items, '加组：每个动作 +1 组'] : d.items,
  }));
}
