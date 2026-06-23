#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'https://gbsag.com';
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

const ROBOTS_NOINDEX_RE =
  /<meta[^>]*(?:name=["']robots["'][^>]*content=["'][^"']*noindex|content=["'][^"']*noindex[^>]*name=["']robots["'])/i;
const REDIRECT_STUB_RE = /^(energy-reveal|shop-login|shop-callback)(?:\.[a-z-]+)?\.html$/i;

const escapeXml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toIsoDate = (mtimeMs) => new Date(mtimeMs).toISOString().slice(0, 10);

const htmlFiles = fs
  .readdirSync(ROOT)
  .filter((file) => file.endsWith('.html'))
  .filter((file) => !file.startsWith('partials.'))
  .filter((file) => !REDIRECT_STUB_RE.test(file));

const indexable = htmlFiles
  .map((file) => {
    const fullPath = path.join(ROOT, file);
    const html = fs.readFileSync(fullPath, 'utf8');
    const isNoindex = ROBOTS_NOINDEX_RE.test(html);
    return {
      file,
      fullPath,
      isNoindex,
    };
  })
  .filter((entry) => !entry.isNoindex)
  .sort((a, b) => a.file.localeCompare(b.file, 'en'));

const lines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
];

for (const entry of indexable) {
  const stat = fs.statSync(entry.fullPath);
  const locPath = entry.file === 'index.html' ? '/' : `/${entry.file}`;
  const loc = `${DOMAIN}${locPath}`;
  const lastmod = toIsoDate(stat.mtimeMs);

  lines.push('  <url>');
  lines.push(`    <loc>${escapeXml(loc)}</loc>`);
  lines.push(`    <lastmod>${lastmod}</lastmod>`);
  lines.push('  </url>');
}

lines.push('</urlset>');
lines.push('');

fs.writeFileSync(SITEMAP_PATH, lines.join('\n'), 'utf8');
console.log(`Generated sitemap.xml with ${indexable.length} URL(s).`);
