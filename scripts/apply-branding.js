#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const branding = '<!-- Erstellt durch Kübler Web & Design -->';
const brandingRe = /[ \t]*<!-- Erstellt durch Kübler Web & Design -->\r?\n?/g;

const htmlFiles = fs
  .readdirSync(root)
  .filter((file) => file.endsWith('.html'))
  .sort((a, b) => a.localeCompare(b, 'de'));

let updated = 0;

for (const file of htmlFiles) {
  const filePath = path.join(root, file);
  const current = fs.readFileSync(filePath, 'utf8');
  const withoutBranding = current.replace(brandingRe, '');

  if (!/<head>\s*/i.test(withoutBranding)) {
    continue;
  }

  const next = withoutBranding.replace(/<head>\s*/i, `<head>\n  ${branding}\n  `);

  if (next !== current) {
    fs.writeFileSync(filePath, next, 'utf8');
    updated += 1;
  }
}

console.log(`Applied source branding to ${updated} file(s).`);
