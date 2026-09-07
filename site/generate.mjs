/**
 * 静态站点页面生成器。
 *
 * 设计要点：
 * 1. **内容与呈现分离** —— 五语言文案集中在 content.json，页面骨架只有一份模板，
 *    避免 15 个 HTML 各自手抄导致译文走样；
 * 2. **示例页的符号由本项目军标引擎实时渲染**（通过 esbuild 打包后动态导入），
 *    保证"页面展示的符号 == 应用里画出来的符号"，不会出现图文不符；
 * 3. 页面自带 hreflang 互链、canonical、JSON-LD 结构化数据与 llms.txt 索引声明，
 *    便于搜索引擎与 AI 爬虫发现。
 *
 * 产物直接写入 public/，由 Vite 在构建时原样拷贝到 dist/。
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

/** 站点根目录（本文件位于 site/ 下） */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 站点绝对基址，用于 canonical 与 hreflang。
 * hreflang 规范要求绝对 URL，故部署到 GitHub Pages 时通过环境变量覆盖。
 */
const SITE_URL = (process.env.SITE_URL ?? 'https://example.github.io/map-army').replace(/\/+$/, '');

/** 语言代码到 BCP 47 标签的映射（hreflang 与 html lang 属性均使用） */
const BCP47 = { zh: 'zh-Hans', en: 'en', de: 'de', fr: 'fr', it: 'it' };

/** 默认语言，同时作为 hreflang="x-default" 的指向 */
const DEFAULT_LANG = 'en';

// ────────────────────────────────────────────────────────────
// 载入内容与军标引擎
// ────────────────────────────────────────────────────────────

const content = JSON.parse(readFileSync(join(ROOT, 'site', 'content.json'), 'utf8'));
const examples = JSON.parse(readFileSync(join(ROOT, 'site', 'examples.json'), 'utf8'));

/**
 * 用 esbuild 把 TypeScript 写的军标引擎打成临时 ESM 后动态导入。
 *
 * 走打包而非 ts-node 之类的运行时转译，是因为：
 * - 无需引入额外依赖（esbuild 已是 Vite 的既有依赖）；
 * - 与生产构建使用同一套转译配置，行为一致。
 */
async function loadSymbology() {
  const result = await build({
    entryPoints: [join(ROOT, 'src', 'core', 'symbology', 'index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    write: false,
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

const symbology = await loadSymbology();

// ────────────────────────────────────────────────────────────
// 模板辅助
// ────────────────────────────────────────────────────────────

/** 转义 HTML 特殊字符，防止文案中的尖括号破坏结构 */
function esc(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 页面类型到 URL 路径的映射（相对于站点根） */
const PAGE_PATH = {
  about: (lang) => `about/${lang}.html`,
  example: (lang) => `example/${lang}.html`,
  doc: (lang) => `doc/${lang}/`,
};

/** 页面类型到"回到站点根"的相对前缀 */
const PAGE_PREFIX = { about: '../', example: '../', doc: '../../' };

// ────────────────────────────────────────────────────────────
// 片段渲染
// ────────────────────────────────────────────────────────────

/** 渲染一个内容小节（标题 + 段落 + 可选列表） */
function renderSection(section) {
  const paragraphs = (section.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`).join('\n        ');
  const list = section.list?.length
    ? `\n        <ul>${section.list.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
    : '';
  return `      <section class="card">
        <h2>${esc(section.heading)}</h2>
        ${paragraphs}${list}
      </section>`;
}

/**
 * 渲染示例页的符号陈列。
 *
 * 每个符号由军标引擎渲染为内联 SVG；名称优先取当前语言，
 * 非中英文则回退到英文名称（避免臆造译文）。
 */
function renderGallery(lang) {
  return examples.groups
    .map((group) => {
      const items = group.symbols
        .map((sidcText) => {
          const sidc = symbology.parseSidc(sidcText);
          const definition = symbology.findSymbol(sidc.symbolSet, symbology.entityCodeOf(sidc));
          const label =
            lang === 'zh' ? definition.name : lang === 'en' ? definition.nameEn : definition.nameEn;
          const svg = symbology.symbolToSvg(sidc, { size: 96 });
          return `          <li class="symbol">
            ${svg}
            <span class="symbol-name">${esc(label)}</span>
            <code class="symbol-sidc">${esc(sidcText)}</code>
          </li>`;
        })
        .join('\n');

      return `      <section class="card">
        <h2>${esc(group.captions[lang] ?? group.captions[DEFAULT_LANG])}</h2>
        <ul class="symbol-grid">
${items}
        </ul>
      </section>`;
    })
    .join('\n');
}

/** 渲染语言切换器：当前语言高亮，其余为互链 */
function renderLanguageSwitcher(kind, lang, prefix) {
  const links = Object.keys(content.meta.languages)
    .map((code) => {
      const href = `${prefix}${PAGE_PATH[kind](code)}`;
      const current = code === lang ? ' class="is-current" aria-current="page"' : '';
      return `          <li><a${current} href="${href}" hreflang="${BCP47[code]}" lang="${BCP47[code]}">${esc(
        content.meta.languages[code].label,
      )}</a></li>`;
    })
    .join('\n');
  return `        <nav class="lang" aria-label="Language">
          <ul>
${links}
          </ul>
        </nav>`;
}

/** 渲染主导航：应用入口 + 关于 / 示例 / 文档 */
function renderMainNav(kind, lang, nav, prefix) {
  const items = [
    { key: 'about', href: `${prefix}about/${lang}.html` },
    { key: 'example', href: `${prefix}example/${lang}.html` },
    { key: 'doc', href: `${prefix}doc/${lang}/` },
  ]
    .map((item) => {
      const current = item.key === kind ? ' class="is-current" aria-current="page"' : '';
      return `          <li><a${current} href="${item.href}">${esc(nav[item.key])}</a></li>`;
    })
    .join('\n');
  return `        <nav class="main-nav" aria-label="Site">
          <ul>
${items}
            <li><a class="cta" href="${prefix}">${esc(nav.app)}</a></li>
          </ul>
        </nav>`;
}

/** 组装 JSON-LD 结构化数据 */
function renderJsonLd(kind, lang, page, canonical) {
  const graph = [
    {
      '@type': 'WebPage',
      '@id': canonical,
      url: canonical,
      name: page.title,
      description: page.lead,
      inLanguage: BCP47[lang],
      isPartOf: { '@type': 'WebSite', name: content.meta.siteName, url: `${SITE_URL}/` },
    },
    {
      '@type': 'SoftwareApplication',
      name: content.meta.siteName,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Web',
      url: `${SITE_URL}/`,
      description: content.en.about.lead,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    },
  ];
  return `    <script type="application/ld+json">\n${JSON.stringify(
    { '@context': 'https://schema.org', '@graph': graph },
    null,
    2,
  )}\n    </script>`;
}

// ────────────────────────────────────────────────────────────
// 页面模板
// ────────────────────────────────────────────────────────────

/** 页面内联样式；与应用的 global.css 共用同一套品牌色变量 */
const STYLES = `
    :root {
      --brand: #076391;
      --brand-dark: #054e73;
      --brand-tint: #eaf2f7;
      --ink: #1c2b33;
      --ink-soft: #526771;
      --line: #dbe4ea;
      --bg: #ffffff;
      --radius: 10px;
      --shadow: 0 1px 2px rgba(7, 99, 145, .08), 0 8px 24px rgba(7, 99, 145, .06);
    }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans SC", "PingFang SC",
        "Microsoft YaHei", Roboto, Helvetica, Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.7;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    a { color: var(--brand); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .wrap { width: min(920px, 100% - 2.5rem); margin-inline: auto; }

    .site-header { border-bottom: 1px solid var(--line); background: #fff; }
    .site-header .wrap {
      display: flex; flex-wrap: wrap; align-items: center; gap: .75rem 1.25rem;
      padding: .85rem 0;
    }
    .brand { font-weight: 700; font-size: 1.15rem; color: var(--brand); letter-spacing: .01em; }
    .brand:hover { text-decoration: none; }
    ul { list-style: none; margin: 0; padding: 0; }
    .main-nav { margin-inline-start: auto; }
    .main-nav ul, .lang ul { display: flex; flex-wrap: wrap; gap: .25rem 1rem; }
    .main-nav a, .lang a {
      display: inline-block; padding: .25rem .1rem; font-size: .92rem; color: var(--ink-soft);
      border-bottom: 2px solid transparent;
    }
    .main-nav a.is-current, .lang a.is-current {
      color: var(--brand); border-bottom-color: var(--brand); font-weight: 600;
    }
    .main-nav a.cta {
      color: #fff; background: var(--brand); border-radius: 999px; border-bottom: none;
      padding: .3rem .95rem; font-weight: 600;
    }
    .main-nav a.cta:hover { background: var(--brand-dark); text-decoration: none; }

    main { flex: 1; padding: 2.5rem 0 3rem; }
    h1 { font-size: clamp(1.6rem, 4vw, 2.1rem); line-height: 1.3; margin: 0 0 .6rem; }
    .lead { font-size: 1.05rem; color: var(--ink-soft); margin: 0 0 2rem; max-width: 62ch; }
    .card {
      border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem 1.4rem;
      margin-bottom: 1.25rem; background: #fff; box-shadow: var(--shadow);
    }
    .card h2 {
      font-size: 1.1rem; margin: 0 0 .6rem; color: var(--brand-dark);
      padding-bottom: .45rem; border-bottom: 1px dashed var(--line);
    }
    .card p { margin: .5rem 0; }
    .card ul { margin: .5rem 0; padding-inline-start: 1.25rem; list-style: disc; }
    .card li { margin: .25rem 0; }

    .symbol-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 1rem; margin: 1rem 0 0; padding: 0; list-style: none;
    }
    .symbol { text-align: center; }
    .symbol svg { display: block; margin: 0 auto; max-width: 96px; height: auto; }
    .symbol-name { display: block; font-size: .86rem; margin-top: .35rem; }
    .symbol-sidc {
      display: block; font-size: .7rem; color: var(--ink-soft);
      word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    .site-footer {
      border-top: 1px solid var(--line); background: var(--brand-tint);
      font-size: .88rem; color: var(--ink-soft);
    }
    .site-footer .wrap { padding: 1.25rem 0; display: flex; flex-wrap: wrap; gap: .5rem 1.5rem; }
    @media (prefers-color-scheme: dark) {
      :root { --ink: #e6eef3; --ink-soft: #a8bcc8; --line: #24404f; --bg: #0e1a21; }
      .card { background: #132530; }
      .site-header { background: #0e1a21; border-bottom-color: var(--line); }
      .site-footer { background: #132530; }
    }
`;

/** 渲染完整页面 */
function renderPage(kind, lang) {
  const page = content[lang][kind];
  const nav = content[lang].nav;
  const prefix = PAGE_PREFIX[kind];
  const path = PAGE_PATH[kind](lang);
  const canonical = `${SITE_URL}/${path}`;
  const language = content.meta.languages[lang];

  // hreflang：各语言互链 + x-default 指向默认语言
  const alternates = Object.keys(content.meta.languages)
    .map(
      (code) =>
        `    <link rel="alternate" hreflang="${BCP47[code]}" href="${SITE_URL}/${PAGE_PATH[kind](
          code,
        )}">`,
    )
    .join('\n');

  const body =
    kind === 'example'
      ? renderGallery(lang)
      : page.sections.map(renderSection).join('\n');

  return `<!doctype html>
<html lang="${BCP47[lang]}" dir="${language.dir}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(page.title)} — ${esc(content.meta.siteName)}</title>
    <meta name="description" content="${esc(page.lead)}">
    <meta name="theme-color" content="#076391">
    <link rel="canonical" href="${canonical}">
${alternates}
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}/${PAGE_PATH[kind](DEFAULT_LANG)}">
    <link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="${prefix}icons/apple-touch-icon.png">
    <link rel="manifest" href="${prefix}manifest.json">
    <link rel="alternate" type="text/plain" href="${prefix}llms.txt" title="llms.txt">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${esc(page.title)}">
    <meta property="og:description" content="${esc(page.lead)}">
    <meta property="og:url" content="${canonical}">
${renderJsonLd(kind, lang, page, canonical)}
    <style>${STYLES}    </style>
</head>
<body>
    <header class="site-header">
      <div class="wrap">
        <a class="brand" href="${prefix}">${esc(content.meta.siteName)}</a>
${renderMainNav(kind, lang, nav, prefix)}
${renderLanguageSwitcher(kind, lang, prefix)}
      </div>
    </header>

    <main class="wrap">
      <h1>${esc(page.title)}</h1>
      <p class="lead">${esc(page.lead)}</p>
${body}
    </main>

    <footer class="site-footer">
      <div class="wrap">
        <span>MIT License · 开源复刻版</span>
        <a href="${prefix}llms.txt">llms.txt</a>
        <a href="${prefix}sitemap.xml">Sitemap</a>
        <a href="${prefix}doc/${lang}/">${esc(nav.doc)}</a>
      </div>
    </footer>
</body>
</html>
`;
}

// ────────────────────────────────────────────────────────────
// 生成
// ────────────────────────────────────────────────────────────

const KINDS = ['about', 'example', 'doc'];
const LANGS = Object.keys(content.meta.languages);
let count = 0;

for (const kind of KINDS) {
  for (const lang of LANGS) {
    const relative = PAGE_PATH[kind](lang);
    // doc 页的路径以斜杠结尾，落到目录下的 index.html
    const file = join(ROOT, 'public', relative.endsWith('/') ? `${relative}index.html` : relative);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, renderPage(kind, lang), 'utf8');
    count += 1;
  }
}

console.log(`静态页面生成完毕：${count} 个（${KINDS.length} 类 × ${LANGS.length} 语言）→ public/`);
