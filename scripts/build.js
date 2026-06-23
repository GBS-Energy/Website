#!/usr/bin/env node
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const run = (script) => {
  execFileSync('node', [path.join(root, 'scripts', script)], { stdio: 'inherit' });
};

run('sync-layout.js');
run('apply-branding.js');
run('generate-sitemap.js');
console.log('Build complete.');
