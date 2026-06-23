#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const partialsDir = path.join(root, 'partials');

const headerRe = /<header class="site-header">[\s\S]*?<\/header>/;
const footerRe = /<footer class="site-footer">[\s\S]*?<\/footer>/;

const readPartial = (name) => {
  const full = path.join(partialsDir, name);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing partial: ${full}`);
  }
  return fs.readFileSync(full, 'utf8').trim();
};

const partials = {
  de: {
    header: readPartial('header.de.html'),
    footer: readPartial('footer.de.html'),
  },
  en: {
    header: readPartial('header.en.html'),
    footer: readPartial('footer.en.html'),
  },
  es: {
    header: readPartial('header.es.html'),
    footer: readPartial('footer.es.html'),
  },
  fr: {
    header: readPartial('header.fr.html'),
    footer: readPartial('footer.fr.html'),
  },
  yue: {
    header: readPartial('header.yue.html'),
    footer: readPartial('footer.yue.html'),
  },
};

const htmlFiles = fs.readdirSync(root).filter((file) => file.endsWith('.html'));

let updated = 0;
htmlFiles.forEach((file) => {
  const filePath = path.join(root, file);
  const data = fs.readFileSync(filePath, 'utf8');
  const lang = file.endsWith('.en.html')
    ? 'en'
    : file.endsWith('.es.html')
    ? 'es'
    : file.endsWith('.fr.html')
    ? 'fr'
    : file.endsWith('.yue.html')
    ? 'yue'
    : 'de';
  const header = partials[lang].header;
  const footer = partials[lang].footer;

  let next = data.replace(headerRe, header);
  next = next.replace(footerRe, footer);

  if (next !== data) {
    fs.writeFileSync(filePath, next, 'utf8');
    updated += 1;
  }
});

console.log(`Synced layout for ${updated} file(s).`);
