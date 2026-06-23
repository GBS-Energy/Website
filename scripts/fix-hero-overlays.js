#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const assetVersion = '20260623-03';
const files = fs.readdirSync(root).filter((file) => file.endsWith('.html'));

let updated = 0;

for (const file of files) {
  const filePath = path.join(root, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let next = content;

  next = next.replace(/site\.css\?v=20260623-02/g, `site.css?v=${assetVersion}`);
  next = next.replace(/site\.js\?v=20260623-02/g, `site.js?v=${assetVersion}`);

  next = next.replace(
    /background-image:linear-gradient\(135deg, rgba\(255,255,255,\.2\), rgba\(255,255,255,\.08\)\), url\(([^)]+)\); background-size:cover; background-position:center; background-repeat:no-repeat;/g,
    'background-image:url($1); background-size:cover; background-position:center; background-repeat:no-repeat;'
  );

  if (next !== content) {
    fs.writeFileSync(filePath, next, 'utf8');
    updated += 1;
  }
}

console.log(`Updated ${updated} HTML file(s), asset version ${assetVersion}.`);
