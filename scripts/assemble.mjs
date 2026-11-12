// Writes src/client.css and src/i18n/<lang>.yaml from the kit and every family, the two files kitap reads whole.
// Run it after a change to a family's client.css or i18n: node scripts/assemble.mjs
// With --check it writes nothing and fails when either file is out of date, which the tests run.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FAMILIES from '../src/families.mjs';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src'), DIR = path.join(SRC, 'families');
const checking = process.argv.includes('--check');
const problems = [];
// src/families.mjs is the one list of families. A folder it leaves out would ship styles and strings with no scene.
const families = FAMILIES.map(f => f.id), folders = fs.readdirSync(DIR).filter(f => fs.statSync(path.join(DIR, f)).isDirectory());
for (const f of folders) if (!families.includes(f)) problems.push(`src/families/${f}/ is not in src/families.mjs, add it there or remove the folder`);
for (const f of families) if (!folders.includes(f)) problems.push(`src/families.mjs names ${f}, which has no folder in src/families/`);

const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trimEnd() : '';
const write = (file, text) => {
  if (!checking) return fs.writeFileSync(file, text);
  if (read(file) !== text.trimEnd()) problems.push(`${path.relative(path.dirname(SRC), file)} is out of date, run node scripts/assemble.mjs`);
};

const css = [read(path.join(SRC, 'kit/kit.css')), ...families.map(f => read(path.join(DIR, f, 'client.css')))].filter(Boolean);
write(path.join(SRC, 'client.css'), css.join('\n\n') + '\n');

fs.mkdirSync(path.join(SRC, 'i18n'), { recursive: true });
for (const file of fs.readdirSync(path.join(SRC, 'kit/i18n'))) {
  const parts = [read(path.join(SRC, 'kit/i18n', file)), ...families.map(f => read(path.join(DIR, f, 'i18n', file)))].filter(Boolean);
  // A key belongs to one file, and a second copy would silently win.
  const seen = new Set();
  for (const line of parts.join('\n').split('\n')) {
    const key = /^([\w.-]+):/.exec(line)?.[1];
    if (key && seen.has(key)) problems.push(`${file}: the key ${key} is written twice`);
    if (key) seen.add(key);
  }
  write(path.join(SRC, 'i18n', file), parts.join('\n') + '\n');
}
for (const p of problems) console.error(p);
if (problems.length) process.exit(1);
console.log(checking ? `the styles and strings of ${families.length} families are up to date` : `assembled ${families.length} families`);
