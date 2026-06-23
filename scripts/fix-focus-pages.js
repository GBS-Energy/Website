#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assetVersion = '20260623-06';

const prefixes = [
  'ueberuns',
  'leistungen',
  'produkte',
  'speicher',
  'flaechenpacht-speicher',
];

const targets = fs
  .readdirSync(root)
  .filter((file) => prefixes.some((prefix) => file === `${prefix}.html` || file.startsWith(`${prefix}.`)));

const heroStyleRe =
  / style="background-image:url\([^)]+\); background-size:cover; background-position:center; background-repeat:no-repeat;"/g;

let updatedFiles = 0;
let totalReplacements = 0;

for (const file of targets) {
  const filePath = path.join(root, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let next = content;
  let fileReplacements = 0;

  const replacements = [
    ['site.css?v=20260623-05', `site.css?v=${assetVersion}`],
    ['site.js?v=20260623-05', `site.js?v=${assetVersion}`],
    ['<meta content="#ffffff" name="theme-color"/>', '<meta content="#ebf2fb" name="theme-color"/>'],
    ['name="theme-color" content="#ffffff"', 'name="theme-color" content="#ebf2fb"'],
  ];

  for (const [from, to] of replacements) {
    const parts = next.split(from);
    if (parts.length > 1) {
      fileReplacements += parts.length - 1;
      next = parts.join(to);
    }
  }

  const heroMatches = next.match(heroStyleRe);
  if (heroMatches) {
    fileReplacements += heroMatches.length;
    next = next.replace(heroStyleRe, '');
  }

  if (next !== content) {
    fs.writeFileSync(filePath, next, 'utf8');
    updatedFiles += 1;
    totalReplacements += fileReplacements;
    console.log(`Updated ${file}: ${fileReplacements} change(s)`);
  }
}

console.log(`Focus pages complete: ${updatedFiles} file(s), ${totalReplacements} replacement(s), asset ${assetVersion}.`);
