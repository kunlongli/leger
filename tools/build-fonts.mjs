// 生成本地字体子集：node tools/build-fonts.mjs
// Google Fonts 按 unicode-range 把字体切成很多分片；这里只下载包含源码用字的分片到 fonts/，并生成 fonts/fonts.css。
// 界面文字有改动后重跑一次；子集里没有的字（如用户自定义食材名）会回退到系统字体。
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'fonts');
const SOURCES = ['index.html', 'style.css', ...(await readdir(ROOT)).filter((f) => f.endsWith('.js')), ...(await readdir(join(ROOT, 'views'))).map((f) => `views/${f}`)];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
const LATIN_EXTRA = 'ÉéÈè·—–−×…‘’“”';

const FAMILIES = [
  { family: 'Noto Serif SC', weights: [400, 500] },
  { family: 'Cormorant Garamond', weights: [300, 400, 500] },
  { family: 'Jost', weights: [300, 400, 500] },
];

async function sourceCodepoints() {
  const texts = await Promise.all(SOURCES.map((f) => readFile(join(ROOT, f), 'utf8')));
  return new Set([...texts.join(''), ...ASCII, ...LATIN_EXTRA].map((c) => c.codePointAt(0)));
}

async function fetchOk(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

// "U+4e00-4e3f, U+30??" → [[start, end], ...]
const parseRanges = (str) => str.split(',').map((part) => {
  const [a, b] = part.trim().replace(/^U\+/i, '').split('-');
  return b ? [parseInt(a, 16), parseInt(b, 16)] : [parseInt(a.replace(/\?/g, '0'), 16), parseInt(a.replace(/\?/g, 'f'), 16)];
});
const hits = (ranges, cps) => [...cps].some((cp) => ranges.some(([lo, hi]) => cp >= lo && cp <= hi));

async function buildFamily({ family, weights }, cps) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weights.join(';')}&display=swap`;
  const css = await (await fetchOk(url, { headers: { 'User-Agent': UA } })).text();
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body]) => ({
    weight: body.match(/font-weight:\s*(\d+)/)[1],
    src: body.match(/url\(([^)]+)\)/)[1],
    range: body.match(/unicode-range:\s*([^;]+);/)?.[1] ?? 'U+0-10FFFF',
  })).filter((f) => hits(parseRanges(f.range), cps));
  const slug = family.toLowerCase().replace(/ /g, '-');
  const rules = await Promise.all(faces.map(async (f, i) => {
    const file = `${slug}-${f.weight}-${i}.woff2`;
    await writeFile(join(OUT, file), Buffer.from(await (await fetchOk(f.src)).arrayBuffer()));
    return `@font-face { font-family: '${family}'; font-weight: ${f.weight}; font-display: swap; src: url('${file}') format('woff2'); unicode-range: ${f.range}; }`;
  }));
  const missing = weights.filter((w) => !faces.some((f) => f.weight === String(w)));
  if (missing.length) throw new Error(`${family}: 缺少字重 ${missing.join(',')}`);
  return { css: rules.join('\n'), count: faces.length };
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const cps = await sourceCodepoints();
const built = await Promise.all(FAMILIES.map((f) => buildFamily(f, cps)));
await writeFile(join(OUT, 'fonts.css'), `/* 由 tools/build-fonts.mjs 生成，勿手改 */\n${built.map((b) => b.css).join('\n')}\n`);
console.log(FAMILIES.map((f, i) => `${f.family}: ${built[i].count} 片`).join(' · '));
