#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assetVersion = '20260623-02';

const targets = [];
for (const file of fs.readdirSync(root)) {
  if (file.endsWith('.html')) targets.push(path.join(root, file));
}
for (const file of fs.readdirSync(path.join(root, 'partials'))) {
  if (file.endsWith('.html')) targets.push(path.join(root, 'partials', file));
}
targets.push(path.join(root, 'assets', 'js', 'site.js'));
targets.push(path.join(root, 'kontakt-handler.php'));

const replacements = [
  ['site.css?v=20260622-04', `site.css?v=${assetVersion}`],
  ['site.css?v=20260623-01', `site.css?v=${assetVersion}`],
  ['site.js?v=20260622-04', `site.js?v=${assetVersion}`],
  ['site.js?v=20260623-01', `site.js?v=${assetVersion}`],
  ['GBS AG (Green Building Solutions)', 'GBS Energy GmbH'],
  ['Green Building Solutions AG', 'GBS Energy GmbH'],
  ['GBS AG', 'GBS Energy GmbH'],
  ['rgba(95,174,138', 'rgba(47,110,166'],
  ['theme-color" content="#ffffff"', 'theme-color" content="#ebf2fb"'],
];

let updatedFiles = 0;
let totalReplacements = 0;

for (const filePath of targets) {
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');
  let next = content;
  let fileReplacements = 0;

  for (const [from, to] of replacements) {
    const parts = next.split(from);
    if (parts.length > 1) {
      fileReplacements += parts.length - 1;
      next = parts.join(to);
    }
  }

  if (next !== content) {
    fs.writeFileSync(filePath, next, 'utf8');
    updatedFiles += 1;
    totalReplacements += fileReplacements;
  }
}

console.log(`Rebrand complete: ${updatedFiles} file(s), ${totalReplacements} replacement(s).`);
