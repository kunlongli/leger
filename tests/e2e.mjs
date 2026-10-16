// 端到端测试：npm run test:e2e（CI 中每次推送都会跑，失败则不部署）
// 自带静态服务器；浏览器用 playwright 安装的 Chromium。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const DESKTOP = { width: 1280, height: 900 };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = path.endsWith('/') ? `${path}index.html` : path;
  try {
    const body = await readFile(join(ROOT, file));
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const results = [];

// 每个场景一个独立浏览器上下文；收集页面报错与对外请求
async function scenario(name, opts, fn) {
  const ctx = await browser.newContext({ viewport: DESKTOP, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  const external = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
  page.on('request', (r) => !/^(data|blob):/.test(r.url()) && !r.url().startsWith(BASE) && external.push(r.url()));
  try {
    await page.goto(BASE);
    await fn(page, ctx);
    assert.deepEqual(errors, [], '页面报错');
    assert.deepEqual(external, [], '不应请求外部资源');
    results.push(`✓ ${name}`);
  } catch (err) {
    results.push(`✗ ${name}\n    ${err.message.split('\n').slice(0, 6).join('\n    ')}`);
  } finally {
    await ctx.close();
  }
}

const go = (page, view) => page.click(`nav button[data-view="${view}"]`);
const loadSample = (page) => page.click('button[data-action="load-sample"] >> nth=0');
const text = async (loc) => (await loc.textContent()).trim();
const VEG = ['生菜', '西兰花', '上海青', '菠菜', '香菇', '芦笋', '番茄', '黄瓜'];

await scenario('首次打开 → 档案引导，可加载演示数据', {}, async (page) => {
  assert.equal(await text(page.locator('h1')), '从了解你的身体开始');
  await loadSample(page);
  assert.match(await text(page.locator('h1')), /今日代谢已更新/);
  assert.equal(await page.locator('.kpi').count(), 4);
});

await scenario('旧版数据（v1）自动迁移', {}, async (page) => {
  await page.evaluate(() => localStorage.setItem('leger.v1', JSON.stringify({
    profile: { sex: 'female', age: 28, height: 162, weight: 65, target: 55, bodyFat: null, activity: 'sedentary', tier: 'gentle', fasting: 'none', keepMuscle: false },
    logs: [{ date: '2026-10-13', morningWeight: 64.8, eveningWeight: 65.3, sleepStart: '23:30', wake: '07:00', intake: null, steps: null }],
  })));
  await page.reload();
  await go(page, 'kitchen');
  assert.equal(await page.locator('.meal').count(), 3);
});

await scenario('记录校验 + 腰围 + 已吃同步到当日摄入', {}, async (page) => {
  await loadSample(page);
  await go(page, 'journal');
  await page.fill('#f-morningWeight', '500');
  await page.click('button[form="log-form"]');
  assert.match(await text(page.locator('.error').first()), /晨起体重应在/);
  await page.fill('#f-morningWeight', '79.5');
  await page.fill('#f-waist', '88.2');
  await page.click('button[form="log-form"]');
  assert.equal(await text(page.locator('tbody tr').first().locator('td').nth(8)), '88.2');
  await go(page, 'kitchen');
  await page.click('[data-action="eat-option"][data-meal="breakfast"]');
  const kcal = (await text(page.locator('.meal.done .kcal'))).match(/\d+/)[0];
  await go(page, 'journal');
  assert.equal(await page.inputValue('#f-intake'), kcal);
});

await scenario('推荐菜单：换一换、忌口、剩余热量、冰箱组菜', {}, async (page) => {
  await loadSample(page);
  await go(page, 'foods');
  await page.click('[data-action="toggle-group"][data-id="seafood"]');
  for (const id of ['chicken', 'tofu', 'brownrice', 'sweetpotato', 'broccoli', 'spinach', 'egg', 'milk', 'apple']) {
    await page.click(`[data-action="toggle-pantry"][data-id="${id}"]`);
  }
  await go(page, 'kitchen');
  const before = await text(page.locator('.meal').nth(1).locator('.opt.on span'));
  await page.click('[data-action="shuffle"][data-meal="lunch"]');
  assert.notEqual(await text(page.locator('.meal').nth(1).locator('.opt.on span')), before, '换一换应换到另一套');
  assert.equal(await page.locator('.meal').evaluateAll((els) => els.some((e) => /虾|三文鱼|鳕鱼/.test(e.textContent))), false, '不应出现海鲜');
  const dinnerBefore = await text(page.locator('.meal').nth(2).locator('.kcal'));
  await page.fill('.eat-form[data-meal="lunch"] input[name="kcal"]', '1000');
  await page.click('.eat-form[data-meal="lunch"] button');
  assert.notEqual(await text(page.locator('.meal').nth(2).locator('.kcal')), dinnerBefore, '午餐多吃后晚餐应减少');
  await page.click('[data-action="set-source"][data-id="pantry"]');
  const pantryNames = ['鸡胸肉', '北豆腐', '糙米饭', '红薯', '西兰花', '菠菜', '鸡蛋', '低脂牛奶', '苹果'];
  const opts = await page.locator('.meal').first().locator('.opt span').allTextContents();
  assert.ok(opts.length > 0 && opts.every((o) => o.split(' · ').every((n) => pantryNames.includes(n))), `组菜只用冰箱食材: ${opts}`);
});

await scenario('自定义食材：名称转义，不注入 HTML', {}, async (page) => {
  await loadSample(page);
  await go(page, 'foods');
  await page.fill('#f-name', '<img src=x onerror=alert(1)>');
  await page.fill('#f-kcal', '180');
  await page.click('button[form="food-form"]');
  assert.equal(await page.locator('main img').count(), 0);
  assert.match(await text(page.locator('tbody tr').first().locator('td').first()), /<img/);
});

await scenario('高级参数：校验与生效', {}, async (page) => {
  await loadSample(page);
  await go(page, 'plan');
  await page.click('summary[data-action="toggle-settings"]');
  await page.fill('[name="mealShares.none.breakfast"]', '50');
  await page.click('button[form="settings-form"]');
  assert.match(await text(page.locator('details .error')), /合计需为 100%/);
  await page.fill('[name="mealShares.none.breakfast"]', '30');
  await page.fill('[name="deficits.standard"]', '600');
  await page.click('button[form="settings-form"]');
  assert.equal(await text(page.locator('.tier.active .num')), '−600');
});

await scenario('方案页：指南对照与理论依据；菜单按进餐顺序', {}, async (page) => {
  await loadSample(page);
  await go(page, 'plan');
  assert.match(await text(page.locator('text=每周有氧')), /指南 150–300/);
  assert.equal(await page.locator('.basis li').count(), 9);
  await go(page, 'kitchen');
  const first = await text(page.locator('.meal').nth(1).locator('.portion-list li span').first());
  assert.ok(VEG.includes(first), `午餐第一项应为蔬菜，实际 ${first}`);
});

await scenario('周报：生成分享图（电脑端下载）', {}, async (page) => {
  await loadSample(page);
  await go(page, 'progress');
  assert.equal(await page.locator('.kpis').first().locator('.kpi').count(), 4);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-action="share-report"]')]);
  assert.match(dl.suggestedFilename(), /^leger-weekly-.*\.png$/);
});

await scenario('生理期：仅女性显示，记录后标注并给出说明', {}, async (page) => {
  await loadSample(page); // 演示档案为男性
  await go(page, 'journal');
  assert.equal(await page.locator('input[name="period"]').count(), 0);
  await go(page, 'profile');
  await page.selectOption('#f-sex', 'female');
  await page.click('button[form="profile-form"]');
  await go(page, 'journal');
  await page.check('input[name="period"]');
  await page.click('button[form="log-form"]');
  assert.match(await text(page.locator('tbody tr').first().locator('td').first()), /经/);
  await go(page, 'today');
  assert.match(await text(page.locator('.card.dark .tips li').first()), /生理期/);
});

await scenario('称重提醒：生成日历文件', {}, async (page) => {
  await loadSample(page);
  await go(page, 'profile');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button[form="reminder-form"]')]);
  assert.equal(dl.suggestedFilename(), 'leger-reminders.ics');
  const ics = await readFile(await dl.path(), 'utf8');
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 3);
});

await scenario('备份提醒：超过 14 天显示横幅，导出后消失', {}, async (page) => {
  await loadSample(page); // 演示数据跨 35 天、从未备份
  assert.equal(await page.locator('.banner').count(), 1);
  await Promise.all([page.waitForEvent('download'), page.click('.banner [data-action="export"]')]);
  assert.equal(await page.locator('.banner').count(), 0);
  await go(page, 'profile');
  assert.doesNotMatch(await text(page.locator('text=上次备份')), /从未/);
});

await scenario('离线：缓存后断网仍可打开', {}, async (page, ctx) => {
  await loadSample(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'Service Worker 应已接管');
  await ctx.setOffline(true);
  await page.reload();
  assert.match(await text(page.locator('h1')), /今日代谢已更新/);
  await go(page, 'kitchen');
  assert.equal(await page.locator('.meal').count(), 3);
  await ctx.setOffline(false);
});

for (const [name, viewport] of [['深色模式 · 桌面', DESKTOP], ['深色模式 · 手机宽度无横向溢出', { width: 390, height: 844 }]]) {
  await scenario(name, { colorScheme: 'dark', viewport }, async (page) => {
    await loadSample(page);
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(20, 19, 17)');
    for (const view of ['today', 'journal', 'plan', 'kitchen', 'foods', 'progress', 'profile']) {
      await go(page, view);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(width <= viewport.width, `${view} 横向溢出 ${width}px`);
    }
  });
}

await browser.close();
server.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('✗')).length;
console.log(failed ? `\n${failed} 个场景失败` : `\n全部 ${results.length} 个场景通过`);
process.exit(failed ? 1 : 0);
